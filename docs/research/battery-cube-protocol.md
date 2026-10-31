# Protocollo BLE del Battery Cube

Domanda: come un'app Web Bluetooth comanda un Battery Cube di Circuit Cubes e ne legge la Battery voltage. Vocabolario in `GLOSSARY.md`.

Ricerca del 2026-10-31. Tenka non pubblica un documento del protocollo: i fatti vengono dal codice di app che lo usano e dai documenti del prodotto. I link al codice sono fissati a un commit.

## Fonti

- **BC2**: [imurvai/brickcontroller2 `CircuitCubeDevice.cs`](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs), app multi-hub in C#.
- **PY**: [im-simon-wong/CircuitCubes `CircuitCubes.py`](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py), libreria Python.
- **CCR**: [repkovsky/CircuitCubesRemote](https://github.com/repkovsky/CircuitCubesRemote/tree/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425), app web da cui nasce questo progetto.
- **ESP**: [asperka/LEGORemoteCircuitCube `CircuitCube.cpp`](https://github.com/asperka/LEGORemoteCircuitCube/blob/c9b4850b4b587274f4fbcf9b70104bebeaccd850/src/CircuitCube.cpp), controller C++ che guida il Battery Cube con il Remote.
- **MAN**: [manuale del Bluetooth Cube, r3](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182) (Tenka).
- **FCC**: [descrizione tecnica, pratica FCC AUI-TBT01A](https://fccid.io/AUI-TBT01A/Operational-Description/Technical-Description-5059395.pdf).

## Servizio e caratteristiche

- Servizio Nordic UART `6e400001-b5a3-f393-e0a9-e50e24dcca9e`. Si scrive su RX `6e400002-…`; il Battery Cube risponde con notifiche su TX `6e400003-…` ([BC2 L16-18](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L16-L18), [CCR `ble_nus.js` L3-5](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_nus.js#L3-L5)).
- PY e ESP chiamano le due caratteristiche al contrario, dal punto di vista del client: per PY `TX_CHAR` è `6e400002` (write-without-response) e `RX_CHAR` è `6e400003` (notify) ([PY L20-22](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L20-L22)). Qui si usano i nomi Nordic: RX = `6e400002`, TX = `6e400003`.
- Altri servizi elencati da PY: GAP, GATT, Device Information (`0x180A`, con numero di serie e revisioni di firmware, hardware e software) e un servizio sconosciuto `f000ffc0-0451-4000-b000-000000000000`. Non c'è il Battery Service standard `0x180F` ([PY L20-51](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L20-L51)).

## Comando di guida

- Testo ASCII `dNNNc`: segno `+` o `-`, Power su tre cifre (`000`–`255`), Channel minuscolo `a`/`b`/`c`. Esempi: `+124a`, `-080b` ([BC2 L186](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L186), [ESP L75-81](https://github.com/asperka/LEGORemoteCircuitCube/blob/c9b4850b4b587274f4fbcf9b70104bebeaccd850/src/CircuitCube.cpp#L75-L81), [PY L189-209](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L189-L209)).
- Una scrittura può contenere più comandi concatenati, uno per Channel. BC2 manda sempre i tre Channel insieme (`+NNNa+NNNb+NNNc`) e spiega: "according to doc, it's possible to skip 0, but sometimes it did not stop such channel" ([BC2 L29](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L29), [L177-191](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L177-L191)); anche ESP concatena ([ESP L55-62](https://github.com/asperka/LEGORemoteCircuitCube/blob/c9b4850b4b587274f4fbcf9b70104bebeaccd850/src/CircuitCube.cpp#L55-L62)). La "doc" citata da BC2 non è linkata e non l'ho trovata.
- CCR costruisce il comando con `String(speed).padStart(3, '0')`: con una Power negativa sotto 100 produce `-80a` invece di `-080a` ([CCR `index.html` L55-62](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/index.html#L55-L62)).
- PY ed ESP sommano 55 a ogni Power diversa da zero; PY commenta "motor does nothing below 55" ([PY L206](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L206), [ESP L79](https://github.com/asperka/LEGORemoteCircuitCube/blob/c9b4850b4b587274f4fbcf9b70104bebeaccd850/src/CircuitCube.cpp#L79)). La soglia dipende probabilmente dal motore e dal carico: non verificata.

## Stop

- Il byte ASCII `0` ferma tutti i Channel. BC2 lo usa quando tutti i valori sono zero ([BC2 L25](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L25), [L167-175](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L167-L175), [L198-206](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L198-L206)).
- PY invece manda `+000a`, `+000b` e `+000c` ([PY L261-266](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L261-L266)).

## Battery voltage

- **Richiesta**: il byte ASCII `b` scritto su RX ([BC2 L27](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L27), [L226](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L226); [PY L310-315](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L310-L315); [ESP L44-45](https://github.com/asperka/LEGORemoteCircuitCube/blob/c9b4850b4b587274f4fbcf9b70104bebeaccd850/src/CircuitCube.cpp#L44-L45)).
- **Risposta**: testo ASCII con la tensione in volt.
  - BC2 abilita le notifiche su TX alla connessione ([L80-84](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L80-L84)). Scarta le notifiche lunghe al massimo un byte e salva il resto come testo, senza conversioni ([L89-99](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L89-L99)). Lo mostra con l'unità `V` ([L50](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L50)).
  - PY ed ESP leggono TX subito dopo aver scritto `b`, invece di aspettare una notifica. PY toglie i NUL finali: `voltage.decode('utf-8').rstrip('\x00')` ([PY L315](https://github.com/im-simon-wong/CircuitCubes/blob/4ca048383b0c9b906a8c93847b43e6af233e9c4a/CircuitCubes/CircuitCubes.py#L315)).
  - CCR abilita le notifiche e le scrive come testo nel suo terminale, ma non manda mai `b` ([CCR `ble_nus.js` L81](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_nus.js#L81), [L119-129](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_nus.js#L119-L129)).
- **Quando**: BC2 legge una volta dopo la connessione, insieme alle informazioni sul dispositivo ([L101-108](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L101-L108), [L210-226](https://github.com/imurvai/brickcontroller2/blob/3fccd2d17e5d652af9f16aa8e6074b6cb85f74cf/BrickController2/BrickController2/DeviceManagement/CircuitCubeDevice.cs#L210-L226)). ESP legge una volta all'avvio, PY su richiesta. Nessuna delle tre converte in percentuale.

## Hardware

- Batteria interna ricaricabile da 3,7 V ([FCC, p. 1](https://fccid.io/AUI-TBT01A/Operational-Description/Technical-Description-5059395.pdf)), ai polimeri di litio e non sostituibile ([MAN, sezioni BATTERIES e DISPOSAL](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182)).
- Interruttore a sinistra: modalità Bluetooth. Il LED blu lampeggia durante l'abbinamento ed è fisso a connessione avvenuta. Interruttore a destra: Battery mode, con le uscite sempre accese e nessun controllo della tensione ([MAN, PAIRING e BATTERY MODE](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182)).
- In modalità Bluetooth l'uscita A e i perni metallici sono collegati ([MAN, OUTPUTS](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182)).
- In caso di cortocircuito l'alimentazione si interrompe: il LED lampeggia verde e blu e il Battery Cube emette un segnale acustico finché il cortocircuito non viene rimosso ([MAN, PROTECT](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182)). Il manuale non descrive il comportamento con la batteria scarica.
- Si ricarica via USB: il LED è rosso durante la carica e verde a carica completa ([MAN, CHARGING](https://cdn.shopify.com/s/files/1/0013/9585/1322/files/circuit-cubes-bluetooth-instructions-r3.pdf?v=1608096182)).

## Domande aperte

- Testo esatto della risposta a `b`: numero di decimali, terminatori, NUL.
- Se TX trasporta anche altri dati, per esempio un eco dei comandi o messaggi non richiesti.
- Se la lettura diretta di TX funziona su tutti i firmware, visto che PY la dichiara solo notify.
- Tensione a piena carica e soglia di spegnimento; cosa succede con la batteria scarica; quanto cala la tensione sotto carico.
- A cosa serve il servizio `f000ffc0-…`.
- Se esiste la documentazione del protocollo citata da BC2.
