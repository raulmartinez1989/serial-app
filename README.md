# SerialGen — Generador de Números de Serie

Sistema web para generar números de serie únicos con formato `YYWWLLNNNNNN`.

## Formato del número de serie

```
YY   = Dos últimos dígitos del año (ej: 26)
WW   = Semana del año, con cero inicial (ej: 09)
LL   = Línea de manufactura (01–05)
NNNN = Secuencia de 6 dígitos, se reinicia cada semana por línea
```

**Ejemplo:** `2609010000042` → Año 26, Semana 9, Línea 01, Serial #42

---

## Instalación

### Requisitos
- Node.js v18 o superior
- npm

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
npm start

# 3. Abrir en navegador
http://localhost:3000
```

---

## Despliegue en producción (acceso desde Internet)

### Opción A: Railway (recomendado, gratis)
1. Crear cuenta en https://railway.app
2. Crear nuevo proyecto → Deploy from GitHub
3. Subir este código a GitHub y conectar el repo
4. Railway detecta Node.js automáticamente y despliega

### Opción B: Render
1. Crear cuenta en https://render.com
2. New → Web Service → conectar repo GitHub
3. Start Command: `npm start`
4. La base de datos SQLite persiste en `/data` — cambiar ruta en server.js si es necesario

### Opción C: VPS (DigitalOcean, Linode, etc.)
```bash
# En el servidor
git clone <tu-repo>
cd serial-app
npm install
npm install -g pm2
pm2 start server.js --name serialgen
pm2 startup   # para que arranque al reiniciar
```

---

## Anti-colisión

La aplicación usa **SQLite con transacciones atómicas** (`db.transaction()`).
Esto garantiza que incluso si 10 máquinas solicitan un serial simultáneamente,
cada una recibe un número único e irrepetible.

- El contador se incrementa con `INSERT ... ON CONFLICT DO UPDATE SET counter = counter + 1`
- El log registra cada serial con clave `UNIQUE`, lanzando error si hubiera duplicado
- WAL mode activado para mejor rendimiento en lecturas concurrentes

---

## API REST

### POST /api/serial
Genera un nuevo número de serie.

**Body:**
```json
{ "line": "01" }
```

**Respuesta:**
```json
{
  "success": true,
  "serial": "260901000001",
  "yy": "26",
  "ww": "09",
  "line": "01",
  "counter": 1
}
```

### GET /api/serials?line=01&limit=50
Historial de seriales generados.

### GET /api/stats
Estadísticas del contador actual por semana y línea.
"# serial-app" 
