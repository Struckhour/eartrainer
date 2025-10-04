<script lang="ts">
	import Keyboard from "$lib/Keyboard.svelte";
  import { browser } from '$app/environment';
  import GearIcon from '$lib/assets/gear_icon.svg';
  import { localStorageStore } from "$lib/stores/localStorageStore";
  import Explosion from "./Explosion.svelte";
  import { noteStats, statTotals } from "./stats"

  type Particle = {
    id: number;
    x: number;
    y: number;
  };
  let explosions: Particle[] = [];

  function triggerExplosion(x: number, y: number) {
    explosions = [...explosions, { id: Date.now(), x, y }];
  }
  // import GearIcon from '$lib/assets/gear_icon.svg?component';

  let userStats = localStorageStore("userStats", { name: 'Player', rank: 0 });
  let legalNotes = localStorageStore<number[]>("legalNotes", [60, 62, 64, 65]);
  let gameSettings = localStorageStore("settings", { difficulty: 2, tempo: 110});

  function clearUserStats() {
    localStorage.removeItem("userStats");
    userStats = localStorageStore("userStats", { name: 'Player', rank: 0 });
  }

  function changeUserName() {
    if ($userStats.name == "Player") {
      userStats.update(s => ({ ...s, name: "Luke" }));
    } else {
      userStats.update(s => ({ ...s, name: "Player" }));
    }
  }

  function updateUserRank() {
    userStats.update(s => ({ ...s, rank: s.rank + 1 }));
  }

  function updateDifficulty(selectedDifficulty: number) {
    gameSettings.update(s => ({ ...s, difficulty: selectedDifficulty }));
    setDifficulty();
  }

  function updateTempo(selectedTempo: number) {
    gameSettings.update(s => ({ ...s, tempo: selectedTempo }));

  }

  let Tone: any;
  let beatLoop: any;
  let hatLoop: any;
  let hat: any;
  let kick: any;
  let snare: any;
  let bass: any;
  let beatOn = false;
  let paused = false;
  let synth: any | null = null;
  let reverb: any | null = null;
  let pressed = new Set<number>();
  let scheduleRepeat: any;

  let newlyPressed = new Set<number>();
  let displayWin = false;
  let displayLoss = false;
  let displayCountdown = false;
  let count = 5;
  const sixteenth = 150;
  let noteScores: Record<number, number> = {60: 0, 62: 0, 64: 0, 65: 0, 67: 0, 69: 0, 71: 0, 72: 0};
  const allNoteScores: Record<number, number> = {60: 0, 62: 0, 64: 0, 65: 0, 67: 0, 69: 0, 71: 0, 72: 0};
  let notesCorrect: Record<number, number> =  {60: 0, 62: 0, 64: 0, 65: 0, 67: 0, 69: 0, 71: 0, 72: 0};
  let notesWrong: Record<number, number> = {60: 0, 62: 0, 64: 0, 65: 0, 67: 0, 69: 0, 71: 0, 72: 0};

  let bestStreak = 0;
  let firstStart = true;
  let resetGame = false;

  let levelNumber = 1;

  const initialOffset = "0:1:0";
  const songLengthInBars = 400;
  const hitWindow = 0.15;
  let youWon = false;
  let youLose = false;

  let menuOn = false;


  let decrementScore = 2;
  let incrementScore = 1;

  let hotStreak = 0;
  let hotStreakOn = false;

  let beatCount = 0;
  let listenCount = 0;
  let borderOn = false;
  let gameOn = false;
  let introOn = false;
  let drumVolume = -20;
  let stimulusSynth: any | null = null;


  function setDifficulty() {
    if ($gameSettings.difficulty == 1) {
      decrementScore = 1;
      incrementScore = 1;
    } else if ($gameSettings.difficulty == 2) {
      decrementScore = 2;
      incrementScore = 1;
    } else if ($gameSettings.difficulty == 3) {
      decrementScore = 2;
      incrementScore = 0.5;
    } else {
      decrementScore = 4;
      incrementScore = 0.2;
    }
  }

  type ExpectedNote = {
    note: number;
    heardTime: string;
    playTime: string; 
    done: boolean; // true if user hit it or it has been passed in time
  };
  let expectedNotes: ExpectedNote[] = [];
  let bassNotes: ExpectedNote[] = [];
  let scheduledEvents: number[] = []; // store IDs of scheduled events
  let scheduledBassEvents: number[] = [];


  function getFourStepNotes(notes: number[]): number[] {
    if (notes.length === 0) return [];

    const sorted = [...notes].sort((a, b) => a - b);
    const sequence: number[] = [];

    // Pick a random starting index
    let index = Math.floor(Math.random() * sorted.length);
    sequence.push(sorted[index]);

    for (let i = 1; i < 4; i++) {
      // Possible moves: stay, move left (-1), move right (+1)
      const moves: number[] = [];
      if (index > 0) moves.push(index - 1);
      moves.push(index); // stay
      if (index < sorted.length - 1) moves.push(index + 1);

      // Pick a random next index
      index = moves[Math.floor(Math.random() * moves.length)];
      sequence.push(sorted[index]);
    }

    return sequence;
  }


  function scheduleTwoBars(scheduleBar: number, time: number) {
    const sequence = getFourStepNotes($legalNotes);
    let nextNotes: ExpectedNote[] = [];
    for (let i in sequence) {
      const generatedNoteTime: string = `${scheduleBar}:${i}:0`;
      const playNoteTime: string = `${scheduleBar + 1}:${i}:0`;
      nextNotes.push({note: sequence[i], heardTime: generatedNoteTime, playTime: playNoteTime, done: false})
    }
        //add the game notes
    nextNotes.forEach(noteData => {
        const id = Tone.Transport.schedule((time: number) => {
            stimulusSynth.triggerAttackRelease(
                Tone.Frequency(noteData.note, "midi").toFrequency(),
                "8n",
                time
            );
        }, Tone.Time(noteData.heardTime) + Tone.Time(initialOffset));
        scheduledEvents.push(id);
    });
    expectedNotes = expectedNotes.concat(nextNotes);
  }





  function createExpectedNotes() {
    for (let i = 0; i < songLengthInBars; i++) {
      if (i > 1 && i % 2 == 0) {
        for (let j = 0; j < 4; j++) {
          const generatedNoteTime: string = `${i}:${j}:0`;
          const playNoteTime: string = `${i + 1}:${j}:0`;
          expectedNotes.push({note: randomNoteFromArray($legalNotes), heardTime: generatedNoteTime, playTime: playNoteTime, done: false})
        }
      };
    }
  }

  function scheduleExpectedNotes() {
      // Cancel previous schedules
      scheduledEvents.forEach(id => Tone.Transport.clear(id));
      scheduledEvents = [];

      //add 4 intro do half notes
      for (let i = 0; i < 8; i += 2) {
        const id = Tone.Transport.schedule((t: number) => {
          stimulusSynth.triggerAttackRelease(Tone.Frequency(60, "midi").toFrequency(), "4n", t);
        }, Tone.Time(`${0}:${i}:0`) + Tone.Time(initialOffset));
        
        scheduledEvents.push(id);
      }

      //add the game notes
      expectedNotes.forEach(noteData => {
          const id = Tone.Transport.schedule((time: number) => {
              stimulusSynth.triggerAttackRelease(
                  Tone.Frequency(noteData.note, "midi").toFrequency(),
                  "8n",
                  time
              );
          }, Tone.Time(noteData.heardTime) + Tone.Time(initialOffset));
          scheduledEvents.push(id);
      });
  }

  function createBassNotes() {
    bassNotes = []; // reset

    for (let i = 0; i < songLengthInBars; i++) {
      // only start a new note every 2 bars
      if (i % 2 === 0) {
        let barNote: string = "";

        // chord progression every 2 bars
        if (i % 8 === 0) {
          barNote = "C2";
        } else if ((i - 2) % 8 === 0) {
          barNote = "A1";
        } else if ((i - 4) % 8 === 0) {
          barNote = "F1";
        } else if ((i - 6) % 8 === 0) {
          barNote = "G1";
        }

        // generate 2 bars worth of notes
        for (let barOffset = 0; barOffset < 2; barOffset++) {
          const currentBar = i + barOffset;

          for (let j = 0; j < 4; j++) {        // beats
            for (let k = 0; k < 2; k++) {      // subdivisions
              const generatedNoteTime = `${currentBar}:${j}:${k * 2}`;
              bassNotes.push({
                note: Tone.Frequency(barNote).toMidi(),
                heardTime: generatedNoteTime,
                playTime: "",
                done: false
              });
            }
          }
        }
      }
    }
  }


  function scheduleBassNotes() {
      // Cancel previous schedules
      scheduledBassEvents.forEach(id => Tone.Transport.clear(id));
      scheduledBassEvents = [];

      //add the bass notes
      bassNotes.forEach(noteData => {
          const id = Tone.Transport.schedule((time: number) => {
              bass.triggerAttackRelease(
                  Tone.Frequency(noteData.note, "midi").toFrequency(),
                  "16n",
                  time
              );
          }, Tone.Time(noteData.heardTime) + Tone.Time(initialOffset));
          scheduledBassEvents.push(id);
      });
  }

  async function startBeat() {
    setDifficulty();
    console.log("decscore: ", decrementScore);
    menuOn = false;
    
    console.log(noteScores, $legalNotes, "expectedNotes: ", expectedNotes);

    if (firstStart || resetGame) {
      console.log()
      noteScores = Object.fromEntries(
        Object.entries(allNoteScores).filter(([key]) => $legalNotes.includes(Number(key)))
      );
      notesCorrect = Object.fromEntries(
        Object.entries(notesCorrect).filter(([key]) => $legalNotes.includes(Number(key)))
      );
      notesWrong = Object.fromEntries(
        Object.entries(notesWrong).filter(([key]) => $legalNotes.includes(Number(key)))
      );
      for (const key in noteScores) {
        noteScores[key] = 0;
        notesCorrect[key] = 0;
        notesWrong[key] = 0;
      }
    }
    console.log(noteScores);
    for (let i in notesDisplay) {
      notesDisplay[i].hide = false;
    }

    if (!Tone) Tone = await import("tone");
    await Tone.start();
    console.log("AudioContext started");
    youWon = false;
    youLose = false;
    Tone.Transport.bpm.value = $gameSettings.tempo;

    if (firstStart) {
      bass = new Tone.AMSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 1 },
        harmonicity: 0.5,
        volume: -10,
      }).toDestination();
      kick = new Tone.MembraneSynth({
        volume: drumVolume,
      }).toDestination();
      snare = new Tone.NoiseSynth({
        volume: drumVolume,
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
      }).toDestination();
      hat = new Tone.NoiseSynth({
        volume: drumVolume,
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0 }
      }).toDestination();
      synth = new Tone.PolySynth(Tone.Synth, {
        volume: -1,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.07, sustain: 0.2, release: 1.5 },
      }).toDestination();
      reverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).toDestination();
      stimulusSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        volume: -10,
        envelope: { attack: 0.04, decay: 0.8, sustain: 0.7, release: 1.5 }
      }).connect(reverb);
    }

    if (firstStart || resetGame) {
      beatCount = 0;
      listenCount = 0;
    }
    if (firstStart) {
      beatLoop = new Tone.Loop((time: number) => {
        // Kick every beat
        kick.triggerAttackRelease("G1", "8n", time);

        // Snare every second beat
        if (beatCount % 2 === 1) {
          snare.triggerAttackRelease("8n", time);
        }
        if (beatCount % 8 === 0) borderOn = false;
        if ((beatCount + 4) % 8 === 0 && beatCount > 5) borderOn = true;
        if (beatCount == 0) introOn = true;
        if (beatCount == 8) {
          introOn = false;
          gameOn = true;
        }
        if (beatCount > 4 && listenCount > 1) {
          listenCount = listenCount - 1;
        } else {
          listenCount = 4;
        }

        beatCount++;
      }, "4n");

    }

    if (firstStart || resetGame) beatLoop.start(initialOffset);

    if (firstStart) {
      hatLoop = new Tone.Loop((time: number) => {
        hat.triggerAttackRelease("16n", time);
      }, "16n");
    }
    if (firstStart || resetGame) hatLoop.start(initialOffset);
    // Loop for checking if expected notes have been played
    if (firstStart || resetGame) {
      scheduleRepeat = Tone.Transport.scheduleRepeat(() => {
        // const now = Tone.Transport.seconds;
        // console.log(Tone.Transport.position);
        // console.log(expectedNotes);
        for (const expected of expectedNotes) {
          const playTimeInSeconds = Tone.Time(expected.playTime).toSeconds() + Tone.Time(initialOffset).toSeconds();
          const now = Tone.Transport.seconds;
          if (now - playTimeInSeconds + hitWindow < 0) break;
          if (!expected.done && now - playTimeInSeconds > hitWindow) {
            expected.done = true; // mark as processed
            // console.log("Missed note:", expected.note, "at ", now);
            console.log("decrementing score because note: ", expected, "at time: ", Tone.Transport.position);
            noteScores[expected.note] = Math.max(-7, noteScores[expected.note] - decrementScore);
            notesWrong[expected.note] += 1;
            hotStreak = 0;
            hotStreakOn = false;
            if (checkScoresForLoss()) {
              setTimeout(() => {
                stopBeat();
              }, 0);
              setTimeout(() => {
                youLose = true;
              }, 2000);
            } 
            break;
          }
        }
  
        // remove processed notes if you want
        expectedNotes = expectedNotes.filter(n => !n.done);
      }, "16n"); // check every 16th note
    }

    Tone.Transport.start();
    console.log("Beat started");

    //Create and Schedule expectedNotes array (after starting the Transport)
    if (firstStart || resetGame) {
      // createExpectedNotes();
      // scheduleExpectedNotes();
      createBassNotes();
      scheduleBassNotes();
    }

    scheduledEvents.forEach(id => Tone.Transport.clear(id));
    scheduledEvents = [];

    if (firstStart || resetGame) {
      Tone.Transport.scheduleRepeat((time: number) => {
        const [barStr] = Tone.Transport.position.split(":"); // "4:0:0" → ["4", ...]
        const currentBar = parseInt(barStr);
        if (currentBar > 1) scheduleTwoBars(currentBar + 1, time);
      }, "2m");
    }

    firstStart = false;
    beatOn = true;
    paused = false;

  }

  function pauseBeat() {
    Tone.Transport.pause();
    paused = true;
    console.log("Beat paused");
  }

  async function stopBeat() {
    if (!Tone) return;

    console.log("Stopping beat...");

    // 1️⃣ Stop and cancel Transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.cancel();
    // 2️⃣ Stop and dispose loops
    if (beatLoop) { beatLoop.stop(); }
    if (hatLoop) { hatLoop.stop(); }

    // scheduledEvents.forEach(id => Tone.Transport.clear(id));
    // scheduledEvents = [];
    // 6️⃣ Reset your state
    resetGame = true;
    beatOn = false;
    paused = false;

    expectedNotes = [];
    bassNotes = [];
    hotStreak = 0;
    hotStreakOn = false;
    gameOn = false;
    introOn = false;
    borderOn = false;
    console.log("Beat fully stopped and reset.", noteScores, resetGame, expectedNotes);
  }



  function noteOn(note: number) {
    if (!browser || !synth) return;
    const freq = Tone.Frequency(note, "midi").toFrequency();
    const now = Tone.Transport.seconds;
    synth.triggerAttack(freq); // starts the note
    pressed.add(note);
    newlyPressed.add(note);
    for (const expected of expectedNotes) {
        const playTimeInSeconds = Tone.Time(expected.playTime).toSeconds() + Tone.Time(initialOffset).toSeconds();
        if (now - playTimeInSeconds + hitWindow < 0) break;
        if (!expected.done && Math.abs(now - playTimeInSeconds) <= hitWindow) {
          if (note === expected.note) {
            expected.done = true; // mark as processed
            // console.log("Hit:", expected.note, "at ", now);

            noteScores[expected.note] = Math.min(10, noteScores[expected.note] + incrementScore);
            notesCorrect[note] += 1;
            hotStreak += 1;
            if (hotStreak > bestStreak) bestStreak = hotStreak;
            if (hotStreak > 7) {
              hotStreakOn = true;
              for (let key in noteScores) {
                noteScores[key] = Math.min(10, noteScores[key] + ((hotStreak / 32) * incrementScore));
              }
            }
            if (checkScoresForWin()) {
              stopBeat();
              youWon = true;
            }
            break;
          } else {
            expected.done = true;
            // console.log("Played a wrong note at ", now);
            noteScores[expected.note] = Math.max(-7, noteScores[expected.note] - decrementScore);
            notesWrong[expected.note] += 1;
            hotStreak = 0;
            hotStreakOn = false;
            if (checkScoresForLoss()) {
              setTimeout(() => {
                stopBeat();
              }, 0);
              setTimeout(() => {
                youLose = true;
              }, 2000);
            } 
            break;
          }
        }
      }

      // remove processed notes
      expectedNotes = expectedNotes.filter(n => !n.done);
    pressed = new Set(pressed);
  }

  function noteOff(note: number) {
    if (!browser || !synth) return;
    const freq = Tone.Frequency(note, "midi").toFrequency();

    synth.triggerRelease(freq); // releases with envelope
    pressed.delete(note);
    newlyPressed.delete(note);
    pressed = new Set(pressed);
  }

  function countDown() {
  displayCountdown = true;

    for (let i = 5; i >= 0; i--) {
      setTimeout(() => {
        count = i;
        if (i === 0) {
          displayCountdown = false; // hide countdown after the last number
        }
      }, (5 - i) * 4 * sixteenth); // schedule each second apart
    }
  }

  function randomNoteFromArray(notes: number[]): number {
    const randomIndex = Math.floor(Math.random() * notes.length);
    return notes[randomIndex];
  }

  function checkScoresForWin() {
    for (const key in noteScores) {
      if (noteScores[key] < 10) return false;
    }
    return true;
  }

  function checkScoresForLoss() {
    for (const key in noteScores) {
      if (noteScores[key] <= -7) {
        const index = notesDisplay.findIndex(obj => obj.note === parseInt(key));
        setTimeout(() => {
          notesDisplay[index].hide = true;
          triggerExplosion(notesDisplay[index].left, 50 - 5 * noteScores[key])
        }, 200)
        return true;
      }
    }
    return false;
  }

  const notesDisplay = [
  { note: 60, label: "Do", left: 3, hide: false},
  { note: 62, label: "Re", left: 16, hide: false},
  { note: 64, label: "Mi", left: 28, hide: false},
  { note: 65, label: "Fa", left: 40.5, hide: false},
  { note: 67, label: "So", left: 53, hide: false},
  { note: 69, label: "La", left: 65, hide: false},
  { note: 71, label: "Ti", left: 78, hide: false},
  { note: 72, label: "Do", left: 90, hide: false}
];

  function updateLegalNotes(note: number) {
    if ($legalNotes.includes(note)) {
      $legalNotes = $legalNotes.filter(n => n !== note);
    } else {
      $legalNotes = [...$legalNotes, note];
      $legalNotes.sort((a, b) => a - b);
    }
    console.log($legalNotes);
  }
</script>

<div class="w-full relative max-w-[700px] bg-black h-[100vh] mx-auto border-8 border-slate-500 flex flex-col justify-around items-center">

  <!-- start/pause/reset buttons -->
  <div class="flex justify-between w-full pl-2 pr-2">

    {#if !beatOn}
      <button on:click={() => startBeat()} class="block py-1 px-2 mx-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-slate-200 text-2xl cursor-pointer">Start</button>
    {:else if paused}
      <button on:click={() => startBeat()} class="block py-1 px-2 mx-1 rounded-lg bg-green-600 hover:bg-green-700 text-slate-200 text-2xl">Resume</button>
      <button on:click={stopBeat} class="block py-1 px-2 mx-1 rounded-lg bg-red-700 hover:bg-red-800 text-slate-200 text-2xl">Reset</button>
    {:else}
      <button on:click={pauseBeat} class="block py-1 px-2 mx-1 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-slate-800 text-2xl">Pause</button>
      <!-- <button on:click={stopBeat} class="mx-auto block py-1 px-2 mt-2 rounded-lg bg-red-600 text-slate-200 text-2xl">Stop</button> -->
    {/if}
    <button on:click="{() => menuOn = !menuOn}" class="w-12 h-12 text-gray-500 border border-slate-200 rounded-lg flex justify-center items-center cursor-pointer hover:bg-slate-500 hover:border-white"
      class:bg-slate-600={menuOn}
      >
      <img src={GearIcon} alt="Gear" class="w-full h-full" />
    </button>
  </div>
  <!-- <div class="text-white">
    {noteScores[60]}
  </div> -->
  {#if introOn || gameOn}
    <div class="mx-auto text-xl text-blue-500 h-8">{borderOn ? "Play!" : "Listen"} {!borderOn && gameOn ? `${listenCount}`: ''}{gameOn ? '' : 'to "Do"'}</div>
  {:else}
    <div class="mx-auto h-8"></div>
  {/if}
  <div class="bg-black w-full box-border h-[400px] relative my-2 rounded-lg text-blue-80" style="border: {borderOn ? '4px' : '4px'} solid {borderOn ? 'green' : 'darkgreen'};">
    
    {#if displayCountdown}
      <div class="text-6xl mb-8 text-blue-800 z-10 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 w-24 h-24 text-center flex items-center justify-center">{count}</div>
    {/if}
    {#if displayWin}
      <div class="text-6xl mb-8 text-blue-800 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-center flex items-center justify-center">You Win!</div>
    {/if}
    {#if displayLoss}
      <div class="text-6xl mb-8 text-blue-800 bg-blue-200 rounded-full absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-center flex items-center justify-center">Game Over</div>
    {/if}
    {#each notesDisplay as n}
      {#if $legalNotes.includes(n.note)}
      <div
        class="rounded-full z-10 bg-green-300 flex justify-center items-center w-8 h-8 absolute transition-all duration-700 ease-in-out -translate-y-2/4 {n.hide ? 'hidden': ''}"
        style="left: {n.left}%; top: {50 - 5 * noteScores[n.note]}%"
        class:outline-4={hotStreakOn}
        class:outline-orange-400={hotStreakOn}
      >
        {n.label}
      </div>
      {/if}
    {/each}
      <div class="w-full h-[50px] absolute bottom-0 bg-black z-0">
        <svg class="absolute bottom-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 20" preserveAspectRatio="none">
          <polygon 
            points="
              0,20 5,0 10,20 
              15,0 20,20 
              25,0 30,20 
              35,0 40,20 
              45,0 50,20 
              55,0 60,20 
              65,0 70,20 
              75,0 80,20 
              85,0 90,20 
              95,0 100,20 
              105,0 110,20 
              115,0 120,20 
              125,0 130,20 
              135,0 140,20 
              145,0 150,20 
              155,0 160,20 
              165,0 170,20 
              175,0 180,20 
              185,0 190,20 
              195,0 200,20
            " 
            fill="grey"
          />
        </svg>
      </div>
    {#each explosions as e (e.id)}
      <Explosion x={e.x} y={e.y} />
    {/each}
  </div>
  <Keyboard
    onKeyDown={synth ? noteOn : () => {}}
    onKeyUp={synth ? noteOff : () => {}}
    {pressed}
  />

  <!-- STATISTICS BOARD -->
  {#if youWon || youLose}
  <div class="text-2xl absolute z-50 w-[90%] top-[15%] left-2/4 -translate-x-2/4 bg-green-800/90 text-slate-200 border border-slate-200 flex flex-col justify-around items-center">
    <div class="">-- Level {levelNumber} --</div>
    {#if youWon}
      <div class="text-4xl my-2">
        You Did It!
      </div>
    {:else}
      <div class="text-4xl my-2">
        Next time!
    </div>
    {/if}
    <div class="underline my-2">
      Stats
    </div>
    <div>
      Best Streak: {bestStreak}
    </div>
    {#each notesDisplay as n}
      {#if $legalNotes.includes(n.note)}
        <div class="my-1">{noteStats(n.label, n.note, notesCorrect, notesWrong)}</div>
      {/if}
    {/each}
    <div class="my-2">Total Notes: {statTotals(notesCorrect, notesWrong)}</div>
  </div>
  {/if}

    <!-- Menu -->
  {#if menuOn}
  <div class="text-2xl text-black absolute z-50 w-[90%] top-[15%] left-2/4 -translate-x-2/4 bg-slate-300 border-4 border-slate-500 rounded-xl flex flex-col justify-around items-center">
    <div class="my-2">Settings</div>
    <hr class="border-t-2 border-gray-400 my-4 w-full">
    <div class="text-lg">Notes</div>
    <div class="flex justify-around w-full box-border">
      {#each notesDisplay as possibleNote}
      <button on:click={() => updateLegalNotes(possibleNote.note)} class="my-1 box-border px-1 rounded-lg hover:bg-green-500/30 {$legalNotes.includes(possibleNote.note) ? 'outline outline-black bg-green-400 text-black' : 'text-slate-600'}"
        >{possibleNote.label}</button>
      {/each}
    </div>
    <hr class="border-t-2 border-gray-400 my-4 w-full">
    <div class="text-lg">Tempo</div>
    <div class="flex justify-around w-full">
      <button on:click={() => updateTempo(80)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.tempo == 80 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Slow</button>
      <button on:click={() => updateTempo(110)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.tempo == 110 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Medium</button>
      <button on:click={() => updateTempo(140)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.tempo == 140 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Fast</button>
    </div>
    <div>{$gameSettings.tempo} bpm</div>
    <hr class="border-t-2 border-gray-400 my-4 w-full">
    <div class="text-lg">Difficulty</div>
    <div class="flex justify-around w-full">
      <button on:click={() => updateDifficulty(1)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.difficulty == 1 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Easy</button>
      <button on:click={() => updateDifficulty(2)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.difficulty == 2 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Medium</button>
      <button on:click={() => updateDifficulty(3)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.difficulty == 3 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Hard</button>
      <button on:click={() => updateDifficulty(4)} class="my-1 px-1 rounded-lg hover:bg-green-500 {$gameSettings.difficulty == 4 ? 'outline outline-black bg-green-400' : 'text-slate-600'}">Legendary</button>
    </div>
    <hr class="border-t-2 border-gray-400 my-4 w-full">
    <div>
      <button on:click={changeUserName}>Change Name: {$userStats.name}</button>
      <button on:click={updateUserRank}>Change Rank: {$userStats.rank}</button>
      <button on:click={clearUserStats}>Clear User Stats</button>
    </div>
  </div>
  {/if}



</div>



