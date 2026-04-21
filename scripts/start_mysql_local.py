from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

BIN = Path(r"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe")
INI = Path(r"C:\ProgramData\MySQL\MySQL Server 8.4\my.ini")
PID_FILE = Path(__file__).resolve().parent.parent / "mysqld_user.pid"
SERVICE_NAME = "MySQL84"


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def try_start_service() -> bool:
    if not shutil.which("sc"):
        return False

    query = subprocess.run(["sc", "query", SERVICE_NAME], capture_output=True, text=True)
    output = (query.stdout or "") + (query.stderr or "")
    if query.returncode != 0 or "FAILED" in output:
        return False

    if "RUNNING" in output:
        return True

    start = subprocess.run(["sc", "start", SERVICE_NAME], capture_output=True, text=True)
    start_output = (start.stdout or "") + (start.stderr or "")
    return start.returncode == 0 or "START_PENDING" in start_output or "RUNNING" in start_output


if is_port_open("127.0.0.1", 3306):
    print("MySQL ya esta corriendo en 3306.")
    sys.exit(0)

if try_start_service():
    for _ in range(20):
        if is_port_open("127.0.0.1", 3306):
            print("MySQL iniciado por servicio MySQL84.")
            sys.exit(0)
        time.sleep(0.5)

if not BIN.exists():
    print(f"No existe mysqld.exe en: {BIN}")
    sys.exit(1)

if not INI.exists():
    print(f"No existe my.ini en: {INI}")
    sys.exit(1)
proc = subprocess.Popen([str(BIN), f"--defaults-file={INI}"], creationflags=0x00000008)
PID_FILE.write_text(str(proc.pid), encoding="utf-8")

for _ in range(30):
    if is_port_open("127.0.0.1", 3306):
        print(f"MySQL iniciado correctamente. PID={proc.pid}")
        sys.exit(0)
    time.sleep(0.5)

print("MySQL no quedo disponible en 3306.")
sys.exit(1)
