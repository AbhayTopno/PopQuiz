#!/bin/sh
set -e

# Generate runtime config from environment variables
cat > /usr/src/app/public/runtime-config.js <<EOF
window.__ENV__ = {
  API_URL: '${API_URL:-http://localhost:5000}',
  SOCKET_URL: '${SOCKET_URL:-http://localhost:5000}'
};
EOF

echo "Runtime config generated:"
cat /usr/src/app/public/runtime-config.js

# Start the Next.js server
exec node server.js
