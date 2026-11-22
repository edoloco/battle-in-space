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
- **COPILOTO:** otro piloto que te acompaña; su especial queda en un segundo botón (se recarga más lento).
- **EQUIPOS ON/OFF:** con equipos, la mitad de los rivales son tus aliados (no se dañan entre ustedes). Si te eliminan, miras a un aliado hasta que termine.
- **EDITAR SU NOMBRE:** tu nombre aparece en la partida.
- **JUGAR → MUNDO AL AZAR:** cada partida tiene un mundo distinto (colores y cantidad de asteroides).
- **JUGAR → CREAR MUNDO 3D:** tabla de formas (círculo, cuadrado, rectángulo, triángulo), tabla de colores, tamaño y altura; opciones BORRAR, PROBAR y SALIR Y GUARDAR. **MI MUNDO** juega en el mundo guardado.
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
| Caine | Buguea la nave y tira un rayo muy bugeado donde apunta |

En el PC: flechas o WASD, Espacio dispara, Shift turbo, Q/E giro, F especial, V especial del copiloto, G escudo, M misiles, B élitras avanzadas, H botiquín.

## Jugar en línea

- **JUGAR EN LÍNEA → CREAR SALA:** aparece un código de 4 letras. Los demás tocan **UNIRSE** y lo escriben.
- Hasta **8 jugadores**. El anfitrión elige el modo (todos contra todos o equipos), los **bots** (0 a 12), las vidas y el mundo (al azar o el suyo). 1 contra 1 = 2 jugadores y 0 bots.
- Se necesita internet solo para encontrarse (servidor gratuito de PeerJS); el juego va directo entre los teléfonos.
- Versión web para jugar desde un computador: https://edoloco.github.io/battle-in-space/ (activar una vez en Settings → Pages → Source: GitHub Actions).

## Gemas, tienda y editor de nave

- Ganas **5 💎** por cada rival que derribas y **2 💎** por cada cristal que encuentras flotando en la partida.
- **Tienda:** Élitras simples (100, más rápida) · Élitras protectoras (309, botón 🛡 de escudo por 4 s) · Élitras pesadas (500, más lenta pero recibe la mitad del daño) · Tirador de fuego triple (260, tres láseres) · Tirador de fuego rápido (100, muy rápido pero recarga cada 40 tiros) · Tirador de fuego láser (480, láser muy largo que dura poco) · Ametralladora láser (701, chain gun amarilla de 150 disparos que se recarga sola mientras no la usas) · Misiles triples verdes (100, botón 🚀: tres misiles que se esparcen).
- Nuevos: Élitras avanzadas (400, botón ⚡: más rápido por 10 s) · Élitras protectoras 2 (480, escudo de 8 s) · Proyectiles arcoíris (690, botón 🌈: explotan con arcoíris y brillantina) · Botiquín de energía (50, se compra varias veces; botón 🩹).
- En las fases flotan **gasolina** ⛽ (recupera energía) y **corazones** ♥ (una vida más).
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

4 proyectiles · Fondo del mundo 3D
