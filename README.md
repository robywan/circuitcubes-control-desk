# CircuitCubes Control Desk

## Avvio

```sh
npm install
npm run dev
```

Aprire l'indirizzo mostrato da Vite in Chrome o Edge. Web Bluetooth richiede HTTPS oppure localhost.

### Android via USB

Attivare il debug USB, collegare il dispositivo e avviare Vite sul computer. Eseguire:

```sh
adb reverse tcp:5173 tcp:5173
```

Aprire `http://localhost:5173` in Chrome su Android. Per usare un'altra porta, adattare il comando e l'indirizzo.

## Verifiche

```sh
npm run test:unit -- --run
npm run type-check
npm run lint
npm run build
```
