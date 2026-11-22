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
- **‹ϟ› Especial:** el poder de tu piloto (se recarga; brilla cuando está listo)
- Gana el último que queda vivo. Las flechas rojas en el borde muestran dónde están los rivales.
- En el menú se eligen el **PILOTO**, las **VIDAS** (1–9, iguales para todos) y los **RIVALES** (1–20).
- **BUSCAR ACTUALIZACIONES** revisa si hay un APK nuevo en GitHub y lo descarga.

## Pilotos

| Piloto | Especial |
|---|---|
| Víctor | Tornado donde mira: persigue al rival más cercano a su camino, lo chupa y lo daña |
| Ms. Pussles | Rayos donde apunta: 3 descargas, en abanico y saltando de rival en rival |
| Wap | Big Bomb verde: explota y suelta más bombas verdes |
| Big Bad | Montón de huesos donde apunta (3 oleadas) |
| Hum-ater-ed Storm | Misil gigante de wither que persigue |
| Sumperlake | Láser donde apunta |
| Tentaclesilla Storm | Rayo enredante: atrapa, frena y daña de a poco a los que están cerca |
| Kirby | Aspira a los rivales de adelante y después tira un misil estrella |
| Ms. Loquín | Muchos misiles a lo loco |

En el PC: flechas o WASD, Espacio dispara, Shift turbo, Q/E giro, F especial, G escudo, M misiles.

## Gemas, tienda y editor de nave

- Ganas **5 💎** por cada rival que derribas y **2 💎** por cada cristal que encuentras flotando en la partida.
- **Tienda:** Élitras simples (100, más rápida) · Élitras protectoras (309, botón 🛡 de escudo por 4 s) · Élitras pesadas (500, más lenta pero recibe la mitad del daño) · Tirador de fuego triple (260, tres láseres) · Tirador de fuego rápido (100, muy rápido pero recarga cada 40 tiros) · Tirador de fuego láser (480, láser muy largo que dura poco) · Ametralladora láser (701, 20 disparos y se recarga sola mientras no la usas) · Misiles triples verdes (100, botón 🚀: tres misiles que se esparcen).
- Se empieza el juego con **5 💎**.
- **Editar nave:** élitras, zona central (la nave de cualquier piloto), tirador de fuego y misiles.

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
