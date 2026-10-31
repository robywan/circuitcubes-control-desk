# Protocollo BLE del Remote

Domanda: come un'app Web Bluetooth riceve i tasti del Remote LEGO Powered Up (88010) e che altro può leggerne. Vocabolario in `GLOSSARY.md`.

Ricerca del 2026-10-31. Il formato dei messaggi viene dalla documentazione ufficiale del LEGO Wireless Protocol (LWP). La numerazione delle porte e i valori dei tasti del Remote non sono documentati da LEGO: vengono dal codice di due librerie, con link fissati a un commit.

## Fonti

- **LWP**: [LEGO Wireless Protocol 3.0.00, doc r17](https://lego.github.io/lego-ble-wireless-protocol-docs/).
- **NPU**: [nathankellenicki/node-poweredup](https://github.com/nathankellenicki/node-poweredup/tree/589eebed184d3785872ba177d496f911ba381f56), libreria Node.js per gli hub Powered Up.
- **CCR**: [repkovsky/CircuitCubesRemote `ble_lwp.js`](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js), app web da cui nasce questo progetto.

## Servizio e caratteristica

- Servizio `00001623-1212-efde-1623-785feabcd123`. Tutti i messaggi, in entrambe le direzioni, passano dalla caratteristica `00001624-1212-efde-1623-785feabcd123` con le notifiche abilitate ([CCR L3-4](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L3-L4), [L80](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L80); [LWP, Common Message Header](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#common-message-header)).

## Formato dei messaggi

- Ogni messaggio comincia con `[lunghezza, Hub ID, tipo]`. La lunghezza conta l'intero messaggio, header compreso; fino a 127 byte sta in un byte. L'Hub ID vale sempre `0x00` ([LWP, Common Message Header](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#common-message-header), [Message Length Encoding](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#message-length-encoding)).
- CCR sbaglia la lunghezza: `new Uint8Array([arr.length, 0].concat(arr))` conta solo il payload, quindi scrive 8 dove servirebbe 10 ([CCR L195](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L195)). NPU invece la calcola dopo aver aggiunto l'header ([NPU `lpf2hub.ts` L66-68](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L66-L68)).

## Porte del Remote

- `0` tasti di sinistra, `1` tasti di destra, `52` LED, `59` sensore di tensione, `60` (`0x3C`) RSSI ([NPU `remotecontrol.ts` L50-54](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/remotecontrol.ts#L50-L54)). La documentazione LWP non elenca le porte dei singoli hub.
- Alla connessione l'hub annuncia ogni porta con un messaggio Hub Attached I/O (`0x04`), che contiene porta, evento e tipo di dispositivo ([LWP, Hub Attached I/O](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#hub-attached-i-o)). Il tipo dei tasti è `55` (`0x37`, Remote Control Button) ([NPU `consts.ts` L100](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/consts.ts#L100)), assente dalla tabella IO Type ID di LWP.

## Attivazione dei tasti

- I tasti mandano eventi solo dopo un Port Input Format Setup (Single) (`0x41`) per la loro porta. Il frame è di 10 byte: `[0x0A, 0x00, 0x41, porta, modo, delta interval (UInt32), notifiche]`. La risposta è un Port Input Format (`0x47`) ([LWP, Port Input Format Setup (Single)](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#port-input-format-setup-single)).
- Per i tasti: modo `0` (button events), delta interval `1` e notifiche abilitate, cioè `[0x0A, 0x00, 0x41, porta, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]`. NPU e CCR mandano lo stesso payload ([NPU `lpf2hub.ts` L74-75](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L74-L75), [NPU `remotecontrolbutton.ts` L37](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/devices/remotecontrolbutton.ts#L37), [CCR L182-184](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L182-L184)).
- CCR attiva i tasti quando riceve l'Hub Attached I/O della porta `0x3C`: attende 100 ms, attiva la porta 0, attende altri 100 ms e attiva la porta 1 ([CCR L133-140](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L133-L140)). LWP non chiede né quell'evento né le pause: sono scelte di CCR.

## Eventi dei tasti

- Arrivano come Port Value (Single) (`0x45`): `[0x05, 0x00, 0x45, porta, valore]` ([LWP, Port Value (Single)](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#port-value-single)).
- Valori: `0x01` = `+`, `0xFF` = `−`, `0x7F` = rosso, `0x00` = rilascio ([NPU `remotecontrolbutton.ts` L44-49](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/devices/remotecontrolbutton.ts#L44-L49), [CCR L151-169](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L151-L169)).

## Tasto verde

- Senza alcuna configurazione arriva come H/W Network Command (`0x08`) di tipo Connection Request (`0x02`), con `0x01` alla pressione e `0x00` al rilascio: `[0x05, 0x00, 0x08, 0x02, stato]` ([LWP, H/W NetWork Commands](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#h-w-network-commands)). CCR lo decodifica dal byte 4 ([CCR L141-150](https://github.com/repkovsky/CircuitCubesRemote/blob/5cd21bcf56b657a74cf86e8e22d3385cfe9dd425/ble_lwp.js#L141-L150)).
- In alternativa si abilitano gli aggiornamenti della Hub Property Button (`0x02`) con l'operazione Enable Updates (`0x02`), cioè `[0x05, 0x00, 0x01, 0x02, 0x02]`; i report portano lo stato del tasto, `0x01` o `0x00` ([LWP, Hub Property Reference](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#hub-property-reference), [Hub Property Operation](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#hub-property-operation)). NPU fa così alla connessione ([NPU `lpf2hub.ts` L28](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L28), [L188-205](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L188-L205)).

## Batteria

- Hub Property Battery Voltage (`0x06`): percentuale da `0x00` a `0x64` (0–100), inviata dall'hub ([LWP, Hub Property Payload](https://lego.github.io/lego-ble-wireless-protocol-docs/index.html#hub-property-payload)). Gli aggiornamenti si abilitano con `[0x05, 0x00, 0x01, 0x06, 0x02]`; NPU legge il valore dal byte 5 ([NPU `lpf2hub.ts` L32](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L32), [L226-231](https://github.com/nathankellenicki/node-poweredup/blob/589eebed184d3785872ba177d496f911ba381f56/src/hubs/lpf2hub.ts#L226-L231)).

## Domande aperte

- Se gli Hub Attached I/O possono arrivare prima che le notifiche siano attive. In quel caso un'app che li aspetta per attivare i tasti non li attiverebbe mai.
- Se le pause di 100 ms di CCR servono davvero.
- Quanto è affidabile la percentuale di batteria del Remote.
