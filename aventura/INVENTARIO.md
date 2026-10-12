# Inventario de arte de las 40 historias

Generado por `validar_aventura.py --inventario` a partir de `data/catalogo_misiones.json` y la biblioteca SVG.
Todo lo que aparece como **pendiente** se dibuja en las entregas 2 (fondos) y 3 (objetos y accesorios).
Despues de eso el arte queda cerrado: las historias solo reutilizan.

## Resumen

- Fondos: 28 existentes, **0 pendientes**
- Objetos: 246 existentes, **0 pendientes**
- Accesorios pendientes: **0**  |  Caras pendientes: **0**
- Personajes nuevos (se arman con caras, ropa y accesorios; sin arte extra): 18

## Fondos pendientes

| Fondo | Historias |
|---|---|

## Objetos pendientes

| Objeto | Historias |
|---|---|

† El nombre en ingles no esta en tu lista de palabras: el objeto se dibuja igual, pero al tocarlo dira un nombre armado con palabras de tu lista (p. ej. atm -> "a money machine") o quedara como decoracion.

## Accesorios pendientes

| Accesorio | Personajes |
|---|---|

## Personajes nuevos

| id | Nombre | Rol | Voz | Cara | Accesorio |
|---|---|---|---|---|---|
| linda | Linda | vecina nueva | af_kore | 😊 | lazo |
| sam | Sam | conductor de bus | am_eric | 🙂 | gorra |
| mia | Mia | barista | af_river | 😄 | delantal |
| leo | Leo | mesero | am_liam | 🙂 | corbata |
| olivia | Olivia | agente del aeropuerto | bf_alice | 🙂 | corbata |
| patel | Doctor Patel | farmaceuta | bm_daniel | 🧐 | bata |
| grace | Grace | recepcionista | af_jessica | 😊 | corbata |
| clark | Mister Clark | jefe | am_fenrir | 😐 | corbata |
| ruth | Ruth | bibliotecaria | bf_lily | 🙂 | lentes |
| pedro | Pedro | vendedor del mercado | am_santa | 😄 | sombrero |
| joe | Joe | mecánico | am_echo | 😅 | gorra |
| marco | Marco | chef | bm_fable | 😄 | gorro_chef |
| nina | Nina | cantante famosa | af_aoede | 🤩 | lentes_sol |
| walter | Walter | señor mayor del pueblo | bm_george | 😌 | baston |
| hank | Hank | guardia de seguridad | am_onyx | 😐 | gorra |
| kenji | Kenji | compañero de intercambio | am_puck | 🙂 | mochila |
| ben | Ben | cajero del banco | bm_lewis | 🙂 | corbata |
| jake | Jake | amigo de Bryan | am_liam | 😎 | audifonos |

## Historias

### 1. Home before midnight — A casa antes de la medianoche  ·  A2  ·  lote 0

- Objetivo: Find Sara. Take her home before midnight. / Encuentra a Sara. Llévala a casa antes de la medianoche.
- Reglas: 2 Wh Questions (what/where/why/who/when/how), 17 Modales básicos (can, could, should, must, will, would, used to + verbo)
- Escenas: fiesta (fiesta_noche), calle (calle_noche), taxi (taxi_interior_noche), casa (casa_noche)
- Objetos: balloon, cake, pizza, speaker, sofa, table, lamp, taxi, bus, house, door, clock, radio, seat
- Personajes: sara, tom, emma, max, lily, george, bella, rosa, frank, mom

### 2. The new neighbor — La vecina nueva  ·  A2  ·  lote 1

- Objetivo: Meet your new neighbor and find out who she is. / Conoce a tu vecina nueva y averigua quién es.
- Reglas: 2 Wh Questions (what/where/why/who/when/how), 20 3ra persona singular (-s), 22 Artículos (a/an/the)
- Escenas: calle (ciudad_dia), sala (sala_dia)
- Objetos: house, mailbox, fence, box, tree, cup, picture, plant
- Personajes: linda, mom, lily

### 3. Lost phone at the bus stop — Celular perdido en la parada  ·  A2  ·  lote 1

- Objetivo: Find your phone. Ask the people at the bus stop. / Encuentra tu celular. Pregunta a la gente de la parada.
- Reglas: 3 Orden de sustantivos compuestos (bus stop, phone number), 31 Expresiones con "some / any / no" (incluye something/anything/nothing), 8 Pronombre objeto tras preposición (him/her/them, no he/she/they)
- Escenas: parada (ciudad_dia), bus (bus_interior)
- Objetos: bus_stop, bench, phone, bag, bus, sign, trash_can, street_lamp
- Personajes: sam, emma, tom, george

### 4. The busy coffee shop — La cafetería llena  ·  A2  ·  lote 1

- Objetivo: Order coffee and food for all your friends. / Pide café y comida para todos tus amigos.
- Reglas: 6 Need to + infinitivo, 37 Contables vs incontables (few/little, less/fewer, much/many), 22 Artículos (a/an/the)
- Escenas: cafe (cafe_dia)
- Objetos: coffee_machine, cash_register, menu, coffee, tea, cake, cookie, sandwich, milk, cup, table, chair
- Personajes: mia, sara, max, bella

### 5. Which way to the station? — ¿Por dónde queda la estación?  ·  A2  ·  lote 1

- Objetivo: Get to the train station on time. Ask for directions. / Llega a tiempo a la estación de tren. Pide indicaciones.
- Reglas: 16 Preposiciones de movimiento (to/at/for/of con destinos), 39 Preposiciones (to/at/in/on/for/during/from/of), 33 Sujeto "it" (clima, tiempo, distancia)
- Escenas: calle (ciudad_dia), parque (parque_dia), estacion (estacion_tren)
- Objetos: traffic_light, map, sign, bench, station, train, clock, ticket, bridge
- Personajes: george, lily, hank, sam

### 6. Out in the rain — Bajo la lluvia  ·  A2  ·  lote 1

- Objetivo: Stay dry and get home after the storm. / No te mojes y llega a casa después de la tormenta.
- Reglas: 30 Get + adjetivo (cambios de estado: get worried, se puso...), 49 because of / because, 33 Sujeto "it" (clima, tiempo, distancia), 27 Too vs Very
- Escenas: calle (calle_lluvia), parada (calle_lluvia), casa (sala_dia)
- Objetos: umbrella, water, bus_stop, rain, cloud, towel, tea, coat
- Personajes: jake, emma, mom

### 7. Birthday surprise plan — Plan de cumpleaños sorpresa  ·  A2  ·  lote 2

- Objetivo: Plan a surprise party. Sara must not find out! / Prepara una fiesta sorpresa. ¡Sara no se puede enterar!
- Reglas: 36 Diferencia entre "will" y "going to", 12 Primer condicional (if + presente, will/won't + infinitivo), 17 Modales básicos (can, could, should, must, will, would, used to + verbo)
- Escenas: sala (sala_dia), tienda (tienda_dia), fiesta (fiesta_noche)
- Objetos: cake, balloon, gift, candle, phone, calendar, speaker, table
- Personajes: tom, bella, max, sara

### 8. Moving day — Día de mudanza  ·  A2  ·  lote 2

- Objetivo: Help your friend move. Put every box in the right place. / Ayuda a tu amigo a mudarse. Pon cada caja en su lugar.
- Reglas: 11 Bring / Brought, 25 Give / Gave / Given, 19 Participios irregulares (incluye take/took/taken, leave/left/left)
- Escenas: calle (ciudad_dia), sala (sala_dia), cocina (cocina_dia)
- Objetos: moving_truck, box, sofa, lamp, bed, plate, glass, key, stairs
- Personajes: jake, tom, linda

### 9. Lost luggage — Equipaje perdido  ·  A2  ·  lote 2

- Objetivo: Find your suitcase at the airport. / Encuentra tu maleta en el aeropuerto.
- Reglas: 15 Gone vs Left, 21 Say vs Tell, 42 Vocabulario específico
- Escenas: llegadas (aeropuerto), oficina (aeropuerto)
- Objetos: baggage_belt, suitcase, flight_board, passport, ticket, plane, clock, desk
- Personajes: olivia, george, emma

### 10. The sick day — El día de enfermo  ·  A2  ·  lote 2

- Objetivo: Your friend is sick. Get what he needs at the pharmacy. / Tu amigo está enfermo. Consigue lo que necesita en la farmacia.
- Reglas: 47 Half of, 37 Contables vs incontables (few/little, less/fewer, much/many), 30 Get + adjetivo (cambios de estado: get worried, se puso...)
- Escenas: cuarto (sala_dia), farmacia (farmacia)
- Objetos: bed, blanket, thermometer, medicine, water, soup, cash_register, shelf
- Personajes: jake, patel, lily

### 11. The lost shopping list — La lista de compras perdida  ·  A2  ·  lote 2

- Objetivo: You lost the shopping list. Remember what to buy. / Perdiste la lista de compras. Recuerda qué hay que comprar.
- Reglas: 37 Contables vs incontables (few/little, less/fewer, much/many), 47 Half of, 54 Comparativos y superlativos
- Escenas: super (tienda_dia)
- Objetos: shopping_cart, bread, milk, egg, apple, rice, cheese, cash_register, paper, basket
- Personajes: mom, rosa, tom

### 12. The wrong bus — El bus equivocado  ·  A2  ·  lote 2

- Objetivo: You took the wrong bus. Get to your class. / Tomaste el bus equivocado. Llega a tu clase.
- Reglas: 15 Gone vs Left, 16 Preposiciones de movimiento (to/at/for/of con destinos), 35 Uso de "when / while"
- Escenas: bus (bus_interior), calle (ciudad_dia), escuela (ciudad_dia)
- Objetos: bus, bus_stop, map, school, sign, clock, phone
- Personajes: sam, kenji, lily

### 13. Waiting at the restaurant — Esperando en el restaurante  ·  A2-B1  ·  lote 2

- Objetivo: Your food has not come. Talk to the waiter and make it right. / Tu comida no llega. Habla con el mesero y arréglalo.
- Reglas: 32 Already / Yet / Just, 28 Preguntas con presente/pasado perfecto (Have...ever...? / Had...?), 10 Presente perfecto: have/has/had + participio (incluye "just": acaba de/acababa de)
- Escenas: restaurante (restaurante_noche)
- Objetos: menu, table, chair, plate, steak, pasta, glass, candle, bill
- Personajes: leo, sara, marco

### 14. Job interview day — Día de entrevista de trabajo  ·  A2-B1  ·  lote 2

- Objetivo: Get to your job interview on time and do it well. / Llega a tiempo a tu entrevista de trabajo y hazla bien.
- Reglas: 28 Preguntas con presente/pasado perfecto (Have...ever...? / Had...?), 10 Presente perfecto: have/has/had + participio (incluye "just": acaba de/acababa de), 34 Since vs For
- Escenas: calle (ciudad_dia), recepcion (oficina), entrevista (oficina)
- Objetos: building, elevator, folder, desk, computer, clock, plant, coffee
- Personajes: grace, clark, jake

### 15. The missing wallet — La billetera perdida  ·  A2-B1  ·  lote 2

- Objetivo: Find out who was near your wallet before it was lost. / Descubre quién estuvo cerca de tu billetera antes de que se perdiera.
- Reglas: 43 Past Perfect, 13 Past Perfect vs Presente vs Futuro, 15 Gone vs Left
- Escenas: cafe (cafe_dia), parque (parque_dia)
- Objetos: wallet, table, bench, bag, card, money, trash_can, dog
- Personajes: mia, george, bella, hank

### 16. Late for the concert — Tarde para el concierto  ·  A2-B1  ·  lote 3

- Objetivo: Get into the concert. It has already started! / Entra al concierto. ¡Ya empezó!
- Reglas: 43 Past Perfect, 32 Already / Yet / Just, 38 Bad vs Badly
- Escenas: calle (calle_noche), concierto (concierto_noche)
- Objetos: ticket, stage, microphone, guitar, speaker, poster, door
- Personajes: hank, max, nina, bella

### 17. The broken elevator — El ascensor dañado  ·  A2-B1  ·  lote 3

- Objetivo: The elevator is broken. Tell the right people so they can repair it. / El ascensor está dañado. Avisa a quien corresponde para que lo arreglen.
- Reglas: 45 Voz pasiva (presente y con modales), 46 Modales de posibilidad/deducción (there might be, must/might/can't + be), 3 Orden de sustantivos compuestos (bus stop, phone number)
- Escenas: pasillo (pasillo_edificio), calle (ciudad_dia)
- Objetos: elevator, stairs, sign, toolbox, phone, door, box
- Personajes: linda, joe, george

### 18. Who took the cake? — ¿Quién se comió el pastel?  ·  A2-B1  ·  lote 3

- Objetivo: The cake is gone. Find out who took it. / El pastel desapareció. Descubre quién se lo llevó.
- Reglas: 46 Modales de posibilidad/deducción (there might be, must/might/can't + be), 19 Participios irregulares (incluye take/took/taken, leave/left/left), 31 Expresiones con "some / any / no" (incluye something/anything/nothing)
- Escenas: cocina (cocina_dia), sala (sala_dia)
- Objetos: cake, plate, fridge, fork, cookie, dog, window
- Personajes: mom, tom, bella, max

### 19. Hotel check-in — Llegada al hotel  ·  A2-B1  ·  lote 3

- Objetivo: There is a problem with your room. Make it right. / Hay un problema con tu habitación. Resuélvelo.
- Reglas: 29 Tag Questions, 41 Orden natural de la oración en inglés, 49 because of / because
- Escenas: lobby (hotel_lobby), habitacion (sala_dia)
- Objetos: reception_bell, desk, key, card, suitcase, elevator, bed, tv
- Personajes: grace, george, emma

### 20. Weekend plans — Planes de fin de semana  ·  A2-B1  ·  lote 3

- Objetivo: Make plans with your friends for the weekend. / Haz planes con tus amigos para el fin de semana.
- Reglas: 53 Future Continuous, 48 Oraciones con "by" para tiempo futuro, 36 Diferencia entre "will" y "going to"
- Escenas: parque (parque_dia), cafe (cafe_dia)
- Objetos: calendar, phone, bicycle, ticket, coffee, bench, map
- Personajes: jake, sara, max, lily

### 21. The big project at work — El gran proyecto del trabajo  ·  A2-B1  ·  lote 3

- Objetivo: Finish the project on time. / Termina el proyecto a tiempo.
- Reglas: 48 Oraciones con "by" para tiempo futuro, 44 Future Perfect Continuous, 6 Need to + infinitivo
- Escenas: oficina (oficina)
- Objetos: laptop, printer, desk, calendar, clock, coffee, folder, whiteboard
- Personajes: clark, grace, jake

### 22. At the library — En la biblioteca  ·  A2-B1  ·  lote 3

- Objetivo: Find the book you need and learn to use the library. / Encuentra el libro que necesitas y aprende a usar la biblioteca.
- Reglas: 18 Gerundio vs infinitivo (incluye tras preposiciones y before/after + ing), 23 Phrasal verbs con "look" (look for / look up / look at / look like), 6 Need to + infinitivo
- Escenas: biblioteca (biblioteca)
- Objetos: shelf, book, computer, desk, card, lamp, notebook
- Personajes: ruth, kenji, lily

### 23. Lost in the market — Perdido en el mercado  ·  A2-B1  ·  lote 3

- Objetivo: Find the man who sells fruit in the big market. / Encuentra al señor que vende fruta en el mercado grande.
- Reglas: 23 Phrasal verbs con "look" (look for / look up / look at / look like), 16 Preposiciones de movimiento (to/at/for/of con destinos), 8 Pronombre objeto tras preposición (him/her/them, no he/she/they)
- Escenas: mercado (mercado_dia)
- Objetos: market_stall, fruit, banana, tomato, basket, sign, honey, corn
- Personajes: pedro, rosa, george, emma

### 24. The surprise visit — La visita sorpresa  ·  A2-B1  ·  lote 3

- Objetivo: Your guests came early. Get the house ready. / Tus invitados llegaron temprano. Alista la casa.
- Reglas: 21 Say vs Tell, 35 Uso de "when / while", 40 For + período / During + evento
- Escenas: puerta (casa_dia), sala (sala_dia), cocina (cocina_dia)
- Objetos: doorbell, door, sofa, pillow, tea, cookie, stove, clock
- Personajes: george, mom, linda

### 25. A day at the beach — Un día en la playa  ·  A2-B1  ·  lote 4

- Objetivo: Plan a perfect day at the beach for everyone. / Planea un día perfecto en la playa para todos.
- Reglas: 40 For + período / During + evento, 52 Expresiones de tiempo con over, 27 Too vs Very
- Escenas: playa (playa_dia)
- Objetos: umbrella, towel, surfboard, sea, sun, ice_cream, water, bag
- Personajes: jake, bella, max, sara

### 26. The broken car — El carro dañado  ·  A2-B1  ·  lote 4

- Objetivo: Your car broke down. Get it working again with the mechanic. / Tu carro se dañó. Haz que vuelva a funcionar con el mecánico.
- Reglas: 50 (put, try, get, trying, take, lie) + (down, off, on), 14 Make vs Do, 9 Uso básico de "as" = como
- Escenas: carretera (ciudad_dia), taller (taller)
- Objetos: car, tire, toolbox, wrench, phone, road, sign
- Personajes: joe, jake

### 27. The cooking class — La clase de cocina  ·  A2-B1  ·  lote 4

- Objetivo: Cook the meal with no mistakes. / Cocina la comida sin errores.
- Reglas: 14 Make vs Do, 18 Gerundio vs infinitivo (incluye tras preposiciones y before/after + ing), 50 (put, try, get, trying, take, lie) + (down, off, on)
- Escenas: cocina (cocina_dia)
- Objetos: pot, pan, stove, knife, onion, tomato, pasta, salt, paper
- Personajes: marco, bella, kenji

### 28. Dream vacation — Las vacaciones soñadas  ·  B1  ·  lote 4

- Objetivo: Plan the vacation of your dreams. / Planea las vacaciones de tus sueños.
- Reglas: 4 Segundo condicional (if + pasado, would + infinitivo), 17 Modales básicos (can, could, should, must, will, would, used to + verbo), 39 Preposiciones (to/at/in/on/for/during/from/of), 54 Comparativos y superlativos
- Escenas: sala (sala_dia), aeropuerto (aeropuerto)
- Objetos: globe, map, computer, suitcase, passport, plane, flight_board, camera
- Personajes: sara, olivia, george

### 29. If I won a million — Si me ganara un millón  ·  B1  ·  lote 4

- Objetivo: Decide what to do with a big prize. / Decide qué hacer con un premio grande.
- Reglas: 4 Segundo condicional (if + pasado, would + infinitivo), 12 Primer condicional (if + presente, will/won't + infinitivo), 26 Still + hope
- Escenas: tienda (tienda_dia), sala (sala_dia)
- Objetos: ticket, tv, money, sofa, gift, house, car
- Personajes: tom, mom, max

### 30. Waiting for news — Esperando noticias  ·  B1  ·  lote 4

- Objetivo: Wait for important news. Do not worry too much! / Espera una noticia importante. ¡No te preocupes demasiado!
- Reglas: 26 Still + hope, 32 Already / Yet / Just, 52 Expresiones de tiempo con over
- Escenas: casa (casa_dia), sala (sala_dia)
- Objetos: mailbox, letter, phone, computer, clock, tea, calendar
- Personajes: sara, linda, mom

### 31. A long life in town — Una larga vida en el pueblo  ·  B1  ·  lote 4

- Objetivo: Learn the story of the oldest man in town. / Conoce la historia del hombre más viejo del pueblo.
- Reglas: 1 Past Perfect Continuous, 44 Future Perfect Continuous, 34 Since vs For
- Escenas: parque (parque_dia), casa (sala_dia)
- Objetos: bench, photo_album, picture, clock, tree, bird, tea
- Personajes: walter, lily, george

### 32. Something is missing — Algo falta en el museo  ·  B1  ·  lote 4

- Objetivo: Something is missing from the museum. Find out what happened. / Falta algo en el museo. Descubre qué pasó.
- Reglas: 5 Cláusulas relativas (who/which/that, incluyendo explicativas con comas), 46 Modales de posibilidad/deducción (there might be, must/might/can't + be), 45 Voz pasiva (presente y con modales)
- Escenas: sala_museo (museo), oficina (oficina)
- Objetos: statue, vase, display_case, security_camera, picture, map, key
- Personajes: hank, ruth, george, bella

### 33. The famous singer — La cantante famosa  ·  B1  ·  lote 4

- Objetivo: Get in to meet a famous singer. / Logra entrar a conocer a una cantante famosa.
- Reglas: 5 Cláusulas relativas (who/which/that, incluyendo explicativas con comas), 9 Uso básico de "as" = como, 25 Give / Gave / Given
- Escenas: calle (calle_noche), concierto (concierto_noche)
- Objetos: poster, stage, microphone, ticket, camera, flowers, pen
- Personajes: nina, hank, max

### 34. What the neighbors say — Lo que dicen los vecinos  ·  B1  ·  lote 5

- Objetivo: A story about you is going around. Find out the truth. / Hay un chisme sobre ti en el barrio. Descubre la verdad.
- Reglas: 29 Tag Questions, 21 Say vs Tell, 20 3ra persona singular (-s)
- Escenas: calle (ciudad_dia), tienda (tienda_dia)
- Objetos: fence, mailbox, dog, house, cash_register, bread
- Personajes: linda, rosa, pedro, tom

### 35. The wrong weather report — El pronóstico equivocado  ·  B1  ·  lote 5

- Objetivo: The weather report was wrong. Save the party in the park. / El pronóstico se equivocó. Salva la fiesta del parque.
- Reglas: 33 Sujeto "it" (clima, tiempo, distancia), 13 Past Perfect vs Presente vs Futuro, 53 Future Continuous
- Escenas: parque (parque_dia), calle (calle_lluvia)
- Objetos: tv, microphone, umbrella, rain, sun, cloud, table, speaker
- Personajes: jake, sara, max, bella

### 36. The camping trip — El viaje de camping  ·  B1  ·  lote 5

- Objetivo: Spend one night camping in the forest. / Pasa una noche de camping en el bosque.
- Reglas: 1 Past Perfect Continuous, 35 Uso de "when / while", 50 (put, try, get, trying, take, lie) + (down, off, on)
- Escenas: bosque (bosque_noche)
- Objetos: tent, fire, flashlight, backpack, sleeping_bag, moon, owl, map
- Personajes: jake, tom, kenji

### 37. The strange box — La caja extraña  ·  B1  ·  lote 5

- Objetivo: A strange box came. Find out who sent it. / Llegó una caja extraña. Descubre quién la envió.
- Reglas: 11 Bring / Brought, 45 Voz pasiva (presente y con modales), 31 Expresiones con "some / any / no" (incluye something/anything/nothing)
- Escenas: casa (casa_dia), sala (sala_dia)
- Objetos: package, mailbox, box, letter, doorbell, gift
- Personajes: linda, mom, sam

### 38. Learning together — Aprendiendo juntos  ·  B1  ·  lote 5

- Objetivo: Help Kenji practice English and understand him. / Ayuda a Kenji a practicar inglés y entenderlo.
- Reglas: 18 Gerundio vs infinitivo (incluye tras preposiciones y before/after + ing), 8 Pronombre objeto tras preposición (him/her/them, no he/she/they), 38 Bad vs Badly
- Escenas: cafe (cafe_dia), biblioteca (biblioteca)
- Objetos: book, notebook, coffee, whiteboard, phone, pen
- Personajes: kenji, ruth, mia

### 39. The bank visit — La visita al banco  ·  B1  ·  lote 5

- Objetivo: Get help with your card at the bank. / Pide ayuda con tu tarjeta en el banco.
- Reglas: 42 Vocabulario específico, 6 Need to + infinitivo, 2 Wh Questions (what/where/why/who/when/how)
- Escenas: banco (banco), calle (ciudad_dia)
- Objetos: atm, card, money, desk, paper, pen, bank
- Personajes: ben, hank, george

### 40. Find Sara again — Encuentra a Sara otra vez  ·  B1  ·  lote 5

- Objetivo: Sara is lost in the city. Use everything you learned to find her. / Sara se perdió en la ciudad. Usa todo lo que aprendiste para encontrarla.
- Reglas: 12 Primer condicional (if + presente, will/won't + infinitivo), 4 Segundo condicional (if + pasado, would + infinitivo), 43 Past Perfect, 41 Orden natural de la oración en inglés
- Escenas: calle (ciudad_dia), cafe (cafe_dia), estacion (estacion_tren), casa (casa_noche)
- Objetos: phone, map, train, ticket, coffee, taxi, house, door
- Personajes: sara, mia, sam, mom, jake

`*` = pendiente de dibujar.

## Objetos existentes mas reutilizados

clock (9), phone (9), map (7), ticket (7), table (6), sign (6), coffee (6), desk (6), house (5), door (5), bench (5), tea (5), cake (4), speaker (4), sofa (4), mailbox (4), box (4), cash_register (4), calendar (4), computer (4), card (4), lamp (3), bus (3), picture (3), bus_stop (3), bag (3), cookie (3), umbrella (3), water (3), gift (3)
