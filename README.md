System Overview

The project HearHere is a web-based system that allows people who pass by to experience synchronize audio for the media facade installations using their smartphones without installing an app. Visitors simply scan a QR code and connect to the web application, where audio playback is synchronized with the video shown on the facade.

The system consists of three main components:
1. MadMapper
   - Displays the video on the media facade
   - Uses UTC midnight as common synchronization reference to determine the current playback position
2. Web Application
   - Hosts the creator interface
   - Allows creators to upload audio files
   - Serves the audio to visitors
   - Uses the same UTC midnight reference to calculate the current playback position
3. Visitors Phone:
   - Opens the web page in any modern web browser after scanning the QR code
   - Downloads the audio into its cache
   - Calculated the correct playback position using UTC midnight
   - Immediately joins the synchronized experience

-------------------------------------------------------------------------------------

Synchronization

Unlike in many other synchronization systems, MadMapper and the web application do not exchange any sycnhronization data or playback information. They operate completely independently while relying on the same global UTC time reference.
The creator uploads the video to MadMapper and the corresponding audio to the web application. Both system independdently assume that playback is referenced to UTC midnight (00:00 UTC).
Each system calculates the current playback position by determining the elapsed time since UTC midnight and starting plabyback at the corresponding position within the media.
Since both MadMapper and the web application perform the same calculation using the same global clock, the projected video and the audio played on the visitors phones remain synchronized without any direct communication between the two systems.
This approach also allows visitors to join the experiene at any time, as the web application immediately starts playback at the correct position.

-------------------------------------------------------------------------------------

Deployment

How to install MadMapper:

How to start running the server:

To start the installation, navigate to the project folder in your terminal and run:

sudo node server.js

The server is explicitly configured to run on Port 80. This allows users to access the web interface simply by typing the server's IP address (e.g., http://192.168.1.50) without needing to append a port number. Binding to Port 80 requires administrator/root privileges on most operating systems.

How to Use
Once the server is running, make sure your devices are on the same network and open a browser to the server's IP address.

1. Audience Mode (Default)
Open the page and tap Tap to Listen.

The device will automatically calculate network latency and sync to the server's master clock.

Wait for the Creator to start the active queue!

2. Creator Mode (CMS / Upload Node)
Tap the Creator button at the top of the screen.

Enter the administrative credentials:

Username: hbk.saar

Password: FacadeLive2026!

Features:

Upload: Drop MP3 or WAV files into the upload zone (supports chunked uploads for large files).

Manage: Drag and drop to reorder the track library.

Queue: Add or remove tracks from the live sequence.

Broadcast: Hit Start Queue to trigger perfectly synchronized playback across all connected audience devices.

Note on File Storage:
The server handles its own file management. Upon the first run, it will automatically generate an /uploads directory for audio assets, as well as playlist.json and active-playlist.json files to remember your queue state even if the server restarts.

-------------------------------------------------------------------------------------

Using the System

- Open web application in browser
- Navigate to "Creator" interface
- Upload the audio file(s)
- Upload corresponding video into MadMapper
- Press play on MadMapper and on the web page
- Visitors scan the QR code and immediately hear synchronized audio
No cloning of the repository is required for the creator once the server is running.











# MadMapper Showcase Playlist Controller

A Python-based absolute-time synchronization controller for MadMapper. This application ensures frame-accurate, synchronized video playback for live events and installations. By leveraging Network Time Protocol (NTP) and Open Sound Control (OSC), it allows you to schedule exact start times, queue countdowns, and instantly recover mid-show synchronization if a crash occurs.

## Features

* **Absolute Time Synchronization:** Bypasses local system clock drift by referencing atomic UTC time.
* **Playlist Calculations:** Automatically calculates durations of multiple video files and tracks the continuous loop mathematically.
* **Countdown Mode:** Queues your media and triggers playback at the exact scheduled second.
* **Instant Mid-Show Resync:** If the system goes offline, restarting the app will calculate exactly where the video *should* be right now and jump MadMapper to that exact frame.

---

## Prerequisites

Before running this application, ensure you have the following installed:

* **Python 3.7+**
* **MadMapper** (v4.0 or higher recommended)

### Python Dependencies

The script relies on a few external libraries. Open your terminal or command prompt and install them using `pip`:

```bash
pip install python-osc ntplib opencv-python

```

---

## MadMapper Configuration

Because this application operates as a "Sync-and-Release" controller, it triggers the correct starting point but relies on MadMapper to continue playback. **You must configure MadMapper exactly as follows:**

### 1. Enable OSC Control

1. Open MadMapper and go to **Preferences > OSC**.
2. Check **Enable OSC Input**.
3. Ensure the input port is set to **8010**.

### 2. Configure the Media Playlist

1. Load your video files into MadMapper's Media List in the **exact same order** you will load them into the Python app.
2. Select all the videos in the list (except the last one).
3. In the Media Properties panel, set **Action at end of media** to **Play Next Media**.
4. Select the **last video** in the list, and set its **Action at end of media** to **Play First Media**. (This ensures the playlist loops infinitely).

---

## How to Use the Application

1. **Launch the App:** Run the script from your terminal:
```bash
python madmapper_showcase_sync.py

```


2. **Load Your Media (Step 1):**
* Click **Add Files...** and select the videos for your showcase.
* **Crucial:** You must select and load them in the exact sequential order they are meant to play (matching your MadMapper list).
* The app will automatically analyze the files and display the Total Loop Duration.


3. **Set the Showcase Start Time (Step 2):**
* Enter the official start date and time of the showcase in your local time zone.
* Format: `YYYY-MM-DD` and `HH:MM:SS` (e.g., `2026-07-24` and `22:00:00`).


4. **Initiate Sync:**
* Click the large **▶ INITIATE SHOWCASE / RESYNC NOW** button.
* **If before the start time:** The app will lock MadMapper's playhead to `0.0` on the first video and begin a live countdown. It will auto-play when the clock hits zero.
* **If after the start time:** The app calculates how much time has passed, figures out which video should be playing, and instantly jumps MadMapper to the correct percentage of that specific clip.



## Troubleshooting

* **MadMapper isn't responding:** Double-check that OSC input is enabled on port `8010` in MadMapper. Ensure you are running both applications on the same computer (the script sends OSC to `127.0.0.1`).
* **Videos are playing out of order:** Make sure the list in MadMapper perfectly matches the list loaded into the Python application, and that your "Action at end of media" settings are correctly configured to "Play Next Media".
   
