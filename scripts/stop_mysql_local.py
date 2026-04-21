from pathlib import Path
import os
import shutil
import subprocess
import sys

MYSQLADMIN = Path(r"C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqladmin.exe")
PID_FILE = Path(__file__).resolve().parent.parent / "mysqld_user.pid"
SERVICE_NAME = "MySQL84"


def try_stop_service() -> bool:
    if not shutil.which("sc"):
        return False

    query = subprocess.run(["sc", "query", SERVICE_NAME], capture_output=True, text=True)
    output = (query.stdout or "") + (query.stderr or "")
    if query.returncode != 0 or "FAILED" in output:
        return False

    if "STOPPED" in output:
        return True

    stop = subprocess.run(["sc", "stop", SERVICE_NAME], capture_output=True, text=True)
    stop_output = (stop.stdout or "") + (stop.stderr or "")
    return stop.returncode == 0 or "STOP_PENDING" in stop_output or "STOPPED" in stop_output


if try_stop_service():
    print("MySQL detenido por servicio MySQL84.")
    sys.exit(0)

if MYSQLADMIN.exists():
    command = [str(MYSQLADMIN), "-u", "root"]
    mysql_password = os.getenv("MYSQL_PASSWORD", "")
    if mysql_password:
      command.append(f"--password={mysql_password}")
    command.append("shutdown")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode == 0:
        print("MySQL detenido correctamente con mysqladmin.")
        sys.exit(0)

if PID_FILE.exists():
    pid = PID_FILE.read_text(encoding="utf-8").strip()
    if pid.isdigit():
        subprocess.run(["taskkill", "/PID", pid, "/F"], check=False)
        print(f"Intento de cierre por PID={pid} ejecutado.")
        sys.exit(0)

print("No se pudo detener MySQL automaticamente.")
sys.exit(1)
