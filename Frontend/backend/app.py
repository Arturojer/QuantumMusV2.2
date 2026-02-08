# DEPRECATED: This file is no longer used
# Please use server.py instead

from server import *

if __name__ == '__main__':
    print("WARNING: app.py is deprecated. Use 'python server.py' instead.")
    print("Starting server from server.py...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
