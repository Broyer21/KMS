from pathlib import Path
import subprocess
import sys

project_root = Path(__file__).resolve().parent.parent
entrypoint = project_root / 'server' / 'index.js'

if not entrypoint.exists():
	print(f"No existe el entrypoint: {entrypoint}")
	sys.exit(1)

try:
	subprocess.run(['node', str(entrypoint)], cwd=project_root, check=True)
except FileNotFoundError:
	print("No se encontro 'node'. Verifica Node.js en PATH.")
	sys.exit(1)
except subprocess.CalledProcessError as e:
	print(f"El servidor termino con codigo: {e.returncode}")
	sys.exit(e.returncode)
