# ============================================================
# POS F&B QR (pure Vue SPA) — local Docker control
# Static build served by nginx. Mirrors the Coolify image.
#   just build && just run   -> http://localhost:9013
# ============================================================

set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

image := "pos-fnb-qrcode"
container := "pos-fnb-qrcode"
http_port := "9013"     # host port -> container 80 (nginx)

default:
    @just --list

build:
    docker build -t {{image}}:latest .

run:
    docker run -d --name {{container}} -p {{http_port}}:80 {{image}}:latest
    @echo "QR app -> http://localhost:{{http_port}}"

stop:
    -docker stop {{container}}

rm: stop
    -docker rm {{container}}

clean: rm
    -docker rmi {{image}}:latest

rebuild: rm build run

logs:
    docker logs -f {{container}}

sh:
    docker exec -it {{container}} sh

ps:
    docker ps -a --filter name={{container}}
