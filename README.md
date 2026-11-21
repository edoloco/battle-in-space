# Battle in Space 🚀

Juego de naves 3D para Android, al estilo Star Fox. Idea, dibujos y diseño: **Víctor**.

## Descargar el APK

**[⬇️ battle-in-space.apk](https://github.com/edoloco/battle-in-space/releases/download/ultima/battle-in-space.apk)**

Ábrelo desde el teléfono, toca *Instalar* (la primera vez Android pide permitir "instalar apps de origen desconocido" para el navegador). Cada versión nueva se instala encima de la anterior.

## Cómo se juega

- **Joystick (izquierda):** mover la nave
- **Botón grande ✦:** disparar (mantener apretado). Si hay un rival al frente, la mira se fija sola en él
- **✚ Turbo:** más velocidad, gasta la barra amarilla
- **⟲ Giro:** tonel (barrel roll), por un instante no te pueden dañar
- Gana el último que queda vivo. Las flechas rojas en el borde muestran dónde están los rivales.
- En el menú se eligen las **VIDAS** (1–9) y los **RIVALES** (1–20).

En el PC: flechas o WASD, Espacio dispara, Shift turbo, Q/E giro.

## Cómo está hecho

- `www/` — el juego (HTML + JavaScript + [Three.js](https://threejs.org)). Se puede abrir en el navegador para probar.
- `android/` — proyecto Android generado con [Capacitor](https://capacitorjs.com), que envuelve el juego en una app.
- `.github/workflows/apk.yml` — cada `push` a `main` compila el APK en GitHub y lo publica en *Releases* con la etiqueta `ultima`.

Probar en el navegador del PC:

```bash
npx http-server www -p 8080
```

## Ideas para después (del menú de Víctor)

Editar nave · Tienda · Jugar en línea · Crear mundo 3D · Editar copiloto · Equipos · 4 proyectiles
