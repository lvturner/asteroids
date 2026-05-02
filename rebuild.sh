#!/bin/bash
set -e

docker stop asteroids 2>/dev/null || true
docker rm asteroids 2>/dev/null || true
docker build -t asteroids .
docker run -d --name asteroids -p 8080:80 asteroids
echo "Container running at http://localhost:8080"
