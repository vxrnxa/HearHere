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

   
