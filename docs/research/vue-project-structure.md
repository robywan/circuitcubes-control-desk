# Struttura dei moduli TypeScript in Vue

Domanda: dove mettere i moduli TypeScript senza Vue che contengono la logica di guida, la decodifica delle notifiche e le impostazioni dell'app.

Ricerca del 2026-11-01. Le fonti distinguono la logica indipendente da Vue dai composable, ma non prescrivono un nome universale per la sua cartella. La proposta finale è una scelta per questo repo, non una regola di Vue.

## Fonti

- **Vue**: [Composables](https://vuejs.org/guide/reusability/composables.html), [Style Guide, regole fortemente raccomandate](https://vuejs.org/style-guide/rules-strongly-recommended.html), [Tooling](https://vuejs.org/guide/scaling-up/tooling.html) e [Testing](https://vuejs.org/guide/scaling-up/testing.html).
- **Nuxt**: [app/utils](https://nuxt.com/docs/4.x/guide/directory-structure/app/utils), [app/composables](https://nuxt.com/docs/4.x/guide/directory-structure/app/composables) e [shared](https://nuxt.com/docs/4.x/guide/directory-structure/shared). Sono convenzioni e funzionalità di Nuxt, non requisiti di Vue o Vite.
- **Vite**: [Getting Started](https://vite.dev/guide/).
- **Repo**: [struttura `src` al primo commit del progetto](https://github.com/robywan/circuitcubes-control-desk/tree/6df91e74f95011b3d59e96c72052a02bb64b7ffe/src). È uno snapshot di questo progetto, non un link al template upstream di create-vue.

## Vue e Vite

- Vue definisce un composable come funzione che usa la Composition API per incapsulare e riutilizzare logica con stato; distingue questa logica dalle normali funzioni senza stato e usa per i composable la convenzione `use` in camelCase. La guida mostra l'estrazione in file separati anche per organizzare il codice, ma non impone una cartella `composables/` ([Vue, Composables](https://vuejs.org/guide/reusability/composables.html#what-is-a-composable)). I quattro moduli qui esaminati non usano la Composition API: chiamarli composable o metterli in `composables/` confonderebbe questa distinzione.
- La guida ai test descrive la business logic isolata come normali moduli JavaScript/TypeScript non legati a Vue e mostra un esempio `helpers.js` con test accanto. È un esempio di nome e collocazione, non una prescrizione di `helpers/` né un obbligo di spostare i test ([Vue, Testing](https://vuejs.org/guide/scaling-up/testing.html#unit-testing)).
- La Style Guide raccomanda un file per componente e discute l'annidamento dei **componenti**: non estende quelle regole ai moduli TypeScript generici. In particolare, la sua cautela sulle sottocartelle riguarda componenti strettamente accoppiati e non dimostra che l'organizzazione per feature sia vietata ([Vue, Style Guide](https://vuejs.org/style-guide/rules-strongly-recommended.html#tightly-coupled-component-names)).
- Vue indica `create-vue` come scaffold ufficiale basato su Vite ([Vue, Tooling](https://vuejs.org/guide/scaling-up/tooling.html#project-scaffolding)). Il primo commit di questo repo contiene `assets/`, `components/`, `router/`, `views/` e test sotto `components/__tests__/`, ma nessuna delle cartelle candidate per i moduli puri ([Repo](https://github.com/robywan/circuitcubes-control-desk/tree/6df91e74f95011b3d59e96c72052a02bb64b7ffe/src)). Questo è un esempio delle opzioni scelte nel progetto, non prova che create-vue generi sempre le stesse directory o che vieti le altre. Il template upstream e le ragioni delle sue scelte non sono stati verificati a un commit specifico.
- Vite documenta `index.html` come entry point e il concetto di project root, oltre ai template iniziali; nella guida consultata non prescrive una tassonomia per i moduli dentro `src/` ([Vite, Getting Started](https://vite.dev/guide/#index-html-and-project-root)). Analogamente, le pagine Vue consultate non scelgono fra `utils/`, `lib/`, `helpers/`, `services/`, `domain/`, `core/`, `models/` o cartelle per feature.

## Convenzioni Nuxt

- Nuxt usa `app/utils/` per distinguere semanticamente le utility dai composable e per importarle automaticamente; `app/composables/` serve agli auto-import dei composable. La reattività dipende dalle API Vue, non dalla cartella ([Nuxt, utils](https://nuxt.com/docs/4.x/guide/directory-structure/app/utils), [Nuxt, composables](https://nuxt.com/docs/4.x/guide/directory-structure/app/composables)). `utils/` è quindi un precedente nell'ecosistema, non una convenzione obbligatoria di Vue puro; in questo progetto gli import rimarrebbero espliciti.
- `shared/` in Nuxt ha un significato specifico: codice condiviso tra app Vue e server Nitro, senza import di codice Vue o Nitro. Non equivale genericamente a «codice puro» ([Nuxt, shared](https://nuxt.com/docs/4.x/guide/directory-structure/shared)).

## Applicazione a questo repo

- **Proposta:** mettere i quattro file in `src/domain/`. `driving.ts`, `battery-voltage.ts` e `remote.ts` esprimono regole o decodifiche specifiche della guida e dei dispositivi; `settings.ts` raccoglie impostazioni e validazione della stessa app e riceve la stringa da analizzare senza accedere direttamente a `localStorage`. `domain/` rende esplicito il legame con l'app, anziché suggerire utility generiche. È un giudizio progettuale, non una prescrizione delle fonti; `src/utils/` sarebbe una scelta semplice e coerente con il precedente Nuxt. Non occorrono sottocartelle per feature per soli quattro file.
- Aggiornare gli import in `src/views/HomeView.vue`, `src/composables/useBatteryCube.ts` e `src/composables/useRemote.ts` da `../…` a `../domain/…`; analogamente quelli dei test diretti `src/__tests__/driving.spec.ts`, `battery-voltage.spec.ts`, `remote.spec.ts` e `settings.spec.ts`. I test possono restare dove sono. Gli import `./settings` in `driving.ts` e `./driving` in `remote.ts` resterebbero invariati, perché i file si sposterebbero insieme. Non è necessario introdurre l'alias `@` o un barrel.
