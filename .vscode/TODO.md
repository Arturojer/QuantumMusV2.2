# TODO: Fix Game Button and Timer Issues

## Issues Identified
- Buttons are using onclick instead of addEventListener, which may cause issues with event handling.
- Timer is not starting when it's the player's turn in handleGameUpdate.

## Steps to Fix
- [ ] Change all button onclick assignments to addEventListener for buttons[2], buttons[3], buttons[4], and discardBtn.
- [ ] Add code to start the timer in handleGameUpdate when it's the local player's turn.
- [ ] Test the changes to ensure buttons work and timer applies actions on timeout.
