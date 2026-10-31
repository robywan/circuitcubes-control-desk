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

## Pubblicazione

L'app è pubblicata su <https://robywan.github.io/circuitcubes-control-desk/>. Il workflow [`deploy.yml`](.github/workflows/deploy.yml) esegue test e build, poi pubblica `dist/` su GitHub Pages a ogni push su `main`. Si può anche lanciare a mano dalla scheda Actions.

Se il repository viene ricreato o spostato, va rifatta una sola configurazione: Settings → Pages → Source: GitHub Actions.

## Riferimenti

Progetti e documenti consultati su Circuit Cubes, da cui partire per nuove funzioni. Quello che ne abbiamo ricavato sui protocolli, con le citazioni, è in [`docs/research/`](docs/research/): [Battery Cube](docs/research/battery-cube-protocol.md), [Remote](docs/research/remote-protocol.md) e [Web Bluetooth](docs/research/web-bluetooth.md).

- [repkovsky/CircuitCubesRemote](https://github.com/repkovsky/CircuitCubesRemote) (MIT): l'app web da cui nasce questo progetto. Guida il Battery Cube via Nordic UART e legge il Remote via Web Bluetooth.
- [imurvai/brickcontroller2](https://github.com/imurvai/brickcontroller2): app multi-hub. Il driver [`CircuitCubeDevice.cs`](https://github.com/imurvai/brickcontroller2/blob/master/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs) mostra i comandi di guida, lo stop di tutti i Channel (`0`) e la lettura della Battery voltage (`b`, risposta su TX).
- [im-simon-wong/CircuitCubes](https://github.com/im-simon-wong/CircuitCubes): libreria Python. [`CircuitCubes.py`](https://github.com/im-simon-wong/CircuitCubes/blob/main/CircuitCubes/CircuitCubes.py) elenca i servizi e le caratteristiche GATT del Battery Cube.
- [asperka/LEGORemoteCircuitCube](https://github.com/asperka/LEGORemoteCircuitCube): controller in C++ che guida il Battery Cube con il Remote.
- [Manuale del Battery Cube Bluetooth](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182) (Tenka): batteria LiPo e protezione da cortocircuito.
- [Descrizione tecnica nella pratica FCC](https://fccid.io/AUI-TBT01A/Operational-Description/Technical-Description-5059395.pdf): batteria interna ricaricabile da 3,7 V.
- [App ufficiale Circuit Cubes](https://circuitcubes.com/pages/app).

Per il Remote: [LEGO Wireless Protocol](https://lego.github.io/lego-ble-wireless-protocol-docs/) e [node-poweredup](https://github.com/nathankellenicki/node-poweredup).
