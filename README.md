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

   
