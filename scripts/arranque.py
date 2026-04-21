import subprocess
import webbrowser
import time

# Iniciar servidor
subprocess.Popen(["npm", "start"], shell=True)

# Esperar a que arranque
time.sleep(2)

# Abrir navegador
webbrowser.open("http://localhost:3000")