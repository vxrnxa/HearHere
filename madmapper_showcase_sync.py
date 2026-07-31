import os
import sys
import time
from datetime import datetime, timezone, timedelta
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

try:
    import cv2
    import ntplib
    from pythonosc import udp_client
except ImportError as e:
    root = tk.Tk()
    root.withdraw()
    messagebox.showerror(
        "Missing Dependencies", 
        f"Please install required libraries first!\nRun in terminal:\n\npip install python-osc ntplib opencv-python\n\nError: {e}"
    )
    sys.exit(1)


class ShowcaseSyncApp:
    def __init__(self, root):
        self.root = root
        self.root.title("MadMapper Showcase Playlist Controller")
        self.root.geometry("620x620")
        self.root.resizable(False, False)
        
        self.style = ttk.Style()
        self.style.theme_use('clam')
        
        # State Variables
        self.playlist = [] # List of dictionaries containing media metadata
        self.total_duration_ms = 0
        
        self.ntp_offset_seconds = 0.0  
        self.showcase_start_dt = None
        self.countdown_job = None
        
        self.create_widgets()
        self.init_default_time()

    def create_widgets(self):
        # Header
        header_frame = ttk.Frame(self.root, padding=12)
        header_frame.pack(fill='x')
        ttk.Label(header_frame, text="Showcase Playlist Sync & Countdown", font=("Helvetica", 15, "bold")).pack(anchor='w')
        ttk.Label(header_frame, text="Absolute time synchronization for multiple sequential videos.", font=("Helvetica", 9), foreground="gray").pack(anchor='w')
        
        ttk.Separator(self.root, orient='horizontal').pack(fill='x', padx=12)
        
        form_frame = ttk.Frame(self.root, padding=12)
        form_frame.pack(fill='both', expand=True)
        
        # 1. Video Playlist Section
        ttk.Label(form_frame, text="1. Select Video Media Files (In Order):", font=("Helvetica", 10, "bold")).grid(row=0, column=0, sticky='w', pady=(0, 4))
        
        list_frame = ttk.Frame(form_frame)
        list_frame.grid(row=1, column=0, columnspan=2, sticky='ew', pady=(0, 5))
        
        self.listbox = tk.Listbox(list_frame, height=6, selectmode=tk.EXTENDED)
        self.listbox.pack(side='left', fill='x', expand=True)
        
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        scrollbar.pack(side='right', fill='y')
        self.listbox.config(yscrollcommand=scrollbar.set)
        
        btn_frame = ttk.Frame(form_frame)
        btn_frame.grid(row=2, column=0, columnspan=2, sticky='ew', pady=(0, 15))
        ttk.Button(btn_frame, text="Add Files...", command=self.add_files).pack(side='left', padx=(0, 5))
        ttk.Button(btn_frame, text="Clear List", command=self.clear_files).pack(side='left')
        
        self.lbl_total_duration = ttk.Label(btn_frame, text="Total Loop: 0.00s", font=("Helvetica", 10, "bold"), foreground="#0055A4")
        self.lbl_total_duration.pack(side='right')

        # 2. Showcase Start Time Section
        ttk.Label(form_frame, text="2. Showcase Official Start Time (Local Time):", font=("Helvetica", 10, "bold")).grid(row=3, column=0, sticky='w', pady=(0, 4))
        
        time_frame = ttk.Frame(form_frame)
        time_frame.grid(row=4, column=0, columnspan=2, sticky='ew', pady=(0, 15))
        
        ttk.Label(time_frame, text="Date (YYYY-MM-DD):").grid(row=0, column=0, sticky='w', padx=(0, 5))
        self.entry_date = ttk.Entry(time_frame, width=15)
        self.entry_date.grid(row=0, column=1, sticky='w', padx=(0, 15))
        
        ttk.Label(time_frame, text="Time (HH:MM:SS):").grid(row=0, column=2, sticky='w', padx=(0, 5))
        self.entry_time = ttk.Entry(time_frame, width=12)
        self.entry_time.grid(row=0, column=3, sticky='w')

        # 3. Large Live Status Display
        self.display_frame = ttk.LabelFrame(form_frame, text=" Sync Status & Countdown ", padding=10)
        self.display_frame.grid(row=5, column=0, columnspan=2, sticky='ew', pady=(0, 10))
        
        self.lbl_status_main = ttk.Label(
            self.display_frame, 
            text="READY - AWAITING MEDIA", 
            font=("Helvetica", 12, "bold"), 
            anchor="center",
            foreground="#333333"
        )
        self.lbl_status_main.pack(fill='x', pady=4)
        
        self.lbl_status_sub = ttk.Label(
            self.display_frame, 
            text="Load your video playlist to begin.", 
            font=("Helvetica", 9), 
            anchor="center"
        )
        self.lbl_status_sub.pack(fill='x')

        # Action Button
        self.btn_sync = ttk.Button(self.root, text="▶ INITIATE SHOWCASE / RESYNC NOW", command=self.process_showcase_start, state='disabled')
        self.btn_sync.pack(side='bottom', fill='x', padx=12, pady=(0, 12), ipady=10)

    def init_default_time(self):
        now = datetime.now()
        self.entry_date.insert(0, now.strftime("%Y-%m-%d"))
        self.entry_time.insert(0, "22:00:00")

    def add_files(self):
        file_paths = filedialog.askopenfilenames(
            title="Select Video Files",
            filetypes=[("Video Files", "*.mp4 *.mov *.avi *.mkv"), ("All Files", "*.*")]
        )
        
        for path in file_paths:
            self.analyze_and_append_video(path)
            
        self.update_ui_state()

    def clear_files(self):
        self.playlist = []
        self.total_duration_ms = 0
        self.listbox.delete(0, tk.END)
        self.update_ui_state()

    def analyze_and_append_video(self, filepath):
        try:
            file_name = os.path.basename(filepath)
            cap = cv2.VideoCapture(filepath)
            if not cap.isOpened():
                raise ValueError("Could not open video file.")
                
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            
            if fps <= 0 or frame_count <= 0:
                raise ValueError("Invalid metadata.")
            
            duration_ms = int((frame_count / fps) * 1000)
            osc_file_name = file_name.replace(" ", "_")
            
            video_data = {
                "name": file_name,
                "duration_ms": duration_ms,
                "osc_pos": f"/medias/{osc_file_name}/position",
                "osc_play": f"/medias/{osc_file_name}/play_forward"
            }
            
            self.playlist.append(video_data)
            self.total_duration_ms += duration_ms
            
            # Add to listbox view
            display_text = f"{file_name} ({duration_ms / 1000:.2f}s)"
            self.listbox.insert(tk.END, display_text)
            
        except Exception as e:
            messagebox.showerror("Video Read Error", f"Failed to analyze {os.path.basename(filepath)}:\n{e}")

    def update_ui_state(self):
        if len(self.playlist) > 0:
            self.lbl_total_duration.config(text=f"Total Loop: {self.total_duration_ms / 1000:.2f}s")
            self.btn_sync.config(state='normal')
            self.lbl_status_main.config(text="SYSTEM READY", foreground="#008000")
            self.lbl_status_sub.config(text=f"{len(self.playlist)} videos loaded. Ready for sync.")
        else:
            self.lbl_total_duration.config(text="Total Loop: 0.00s")
            self.btn_sync.config(state='disabled')
            self.lbl_status_main.config(text="READY - AWAITING MEDIA", foreground="#333333")
            self.lbl_status_sub.config(text="Load your video playlist to begin.")

    def parse_start_time(self):
        date_str = self.entry_date.get().strip()
        time_str = self.entry_time.get().strip()
        combined = f"{date_str} {time_str}"
        
        formats = [
            "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M",
            "%d.%m.%Y %H:%M:%S", "%d.%m.%Y %H:%M",
            "%d.%m.%y %H:%M:%S", "%d.%m.%y %H:%M"
        ]
        
        for fmt in formats:
            try:
                dt_naive = datetime.strptime(combined, fmt)
                return dt_naive.astimezone()
            except ValueError:
                continue
        return None

    def update_ntp_offset(self):
        try:
            client = ntplib.NTPClient()
            response = client.request("pool.ntp.org", version=3, timeout=2)
            ntp_utc_ts = response.tx_time
        except Exception:
            ntp_utc_ts = datetime.now(timezone.utc).timestamp()
            
        self.ntp_offset_seconds = ntp_utc_ts - time.perf_counter()

    def get_absolute_utc_now(self):
        return datetime.fromtimestamp(time.perf_counter() + self.ntp_offset_seconds, tz=timezone.utc)

    def process_showcase_start(self):
        if len(self.playlist) == 0:
            return
            
        if self.countdown_job:
            self.root.after_cancel(self.countdown_job)
            self.countdown_job = None
            
        start_dt = self.parse_start_time()
        if not start_dt:
            messagebox.showerror("Invalid Date/Time", "Please enter a valid start date and time format.")
            return
            
        self.showcase_start_dt = start_dt
        showcase_utc = start_dt.astimezone(timezone.utc)
        
        self.update_ntp_offset()
        now_utc = self.get_absolute_utc_now()
        
        if now_utc < showcase_utc:
            # Send 0.0 position to the FIRST video in the list to queue it up
            first_vid = self.playlist[0]
            self.send_osc(first_vid["osc_pos"], 0.0)
            self.run_countdown_loop(showcase_utc)
        else:
            self.execute_instant_resync(now_utc, showcase_utc)

    def run_countdown_loop(self, showcase_utc):
        now_utc = self.get_absolute_utc_now()
        remaining_seconds = (showcase_utc - now_utc).total_seconds()
        
        first_vid = self.playlist[0]
        
        if remaining_seconds <= 0:
            # Trigger the first video in the playlist
            self.send_osc(first_vid["osc_pos"], 0.0)
            time.sleep(0.1) 
            self.send_osc(first_vid["osc_play"], 1.0)
            
            self.lbl_status_main.config(text="SHOWCASE RUNNING!", foreground="#008000")
            self.lbl_status_sub.config(text=f"Triggered: {first_vid['name']}")
            return

        td = timedelta(seconds=int(remaining_seconds))
        hours, remainder = divmod(td.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        time_str = f"{td.days * 24 + hours:02d}:{minutes:02d}:{seconds:02d}"
        
        self.lbl_status_main.config(text=f"COUNTDOWN: {time_str}", foreground="#CC0000")
        self.lbl_status_sub.config(text=f"Queued: {first_vid['name']} - Auto-triggering at {self.showcase_start_dt.strftime('%H:%M:%S')}")
        
        self.countdown_job = self.root.after(200, lambda: self.run_countdown_loop(showcase_utc))

    def execute_instant_resync(self, now_utc, showcase_utc):
        elapsed_ms = int((now_utc - showcase_utc).total_seconds() * 1000)
        current_loop_ms = elapsed_ms % self.total_duration_ms
        
        # Determine exactly which video is supposed to be playing
        active_video = None
        local_ms = current_loop_ms
        
        for vid in self.playlist:
            if local_ms < vid["duration_ms"]:
                active_video = vid
                break
            local_ms -= vid["duration_ms"]
            
        normalized_pos = local_ms / active_video["duration_ms"]
        
        # Send OSC commands exclusively to the active video
        self.send_osc(active_video["osc_pos"], normalized_pos)
        time.sleep(0.1)
        self.send_osc(active_video["osc_play"], 1.0)
        
        self.lbl_status_main.config(text="SHOWCASE ACTIVE - SYNCED", foreground="#008000")
        self.lbl_status_sub.config(
            text=f"Playing: {active_video['name']} ({local_ms / 1000:.1f}s / {active_video['duration_ms'] / 1000:.1f}s)"
        )

    def send_osc(self, address, val):
        try:
            client = udp_client.SimpleUDPClient("127.0.0.1", 8010)
            client.send_message(address, val)
        except Exception as e:
            print(f"OSC Send Error: {e}")


if __name__ == "__main__":
    root = tk.Tk()
    app = ShowcaseSyncApp(root)
    root.mainloop()