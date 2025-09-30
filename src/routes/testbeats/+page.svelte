<script lang="ts">
	import Keyboard from "$lib/Keyboard.svelte";
  import { browser } from '$app/environment';

  let Tone: any;
  let beatLoop: any;
  let hatLoop: any;
  let hat: any;
  let kick: any;
  let snare: any;
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
  let noteScores: Record<number, number> = {60: 0, 62: 0, 64: 0, 65: 0, 67: 0};
  let notesCorrect: Record<number, number> =  {60: 0, 62: 0, 64: 0, 65: 0, 67: 0};
  let notesWrong: Record<number, number> = {60: 0, 62: 0, 64: 0, 65: 0, 67: 0};

  let firstStart = true;
  let resetGame = false;

  let levelNumber = 1;
  let bpm = 140;
  const initialOffset = "0:1:0";
  const songLengthInBars = 400;
  const hitWindow = 0.15;
  let youWon = false;
  let youLose = false;


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

  let legalNotes = [60, 62, 64, 65, 67];



  type ExpectedNote = {
    note: number;
    heardTime: string;
    playTime: string; 
    done: boolean; // true if user hit it or it has been passed in time
  };
  let expectedNotes: ExpectedNote[] = [];

  let scheduledEvents: number[] = []; // store IDs of scheduled events

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

  function createExpectedNotes() {
    for (let i = 0; i < songLengthInBars; i++) {
      if (i > 1 && i % 2 == 0) {
        for (let j = 0; j < 4; j++) {
          const generatedNoteTime: string = `${i}:${j}:0`;
          const playNoteTime: string = `${i + 1}:${j}:0`;
          const heardTimeInSeconds = Tone.Time(generatedNoteTime).toSeconds() + Tone.now() + 1;
          const playTimeInSeconds = Tone.Time(playNoteTime).toSeconds() + Tone.now() + 1;
          expectedNotes.push({note: randomNoteFromArray(legalNotes), heardTime: generatedNoteTime, playTime: playNoteTime, done: false})
        }
      };
}
  }

  async function startBeat() {

    if (firstStart || resetGame) {
      noteScores = {60:0,62:0,64:0,65:0,67:0};
      notesCorrect = {60:0,62:0,64:0,65:0,67:0};
      notesWrong = {60:0,62:0,64:0,65:0,67:0};
    }
    if (!Tone) Tone = await import("tone");
    await Tone.start();
    console.log("AudioContext started");
    youWon = false;
    youLose = false;
    Tone.Transport.bpm.value = bpm;

    if (firstStart) {
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
      synth = new Tone.PolySynth(Tone.Synth).toDestination();
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
    if (firstStart) {
      scheduleRepeat = Tone.Transport.scheduleRepeat((t) => {
        const now = Tone.Transport.seconds;
        for (const expected of expectedNotes) {
          const playTimeInSeconds = Tone.Time(expected.playTime).toSeconds() + Tone.Time(initialOffset).toSeconds();
          if (now - playTimeInSeconds + hitWindow < 0) break;
          if (!expected.done && now - playTimeInSeconds > hitWindow) {
            expected.done = true; // mark as processed
            // console.log("Missed note:", expected.note, "at ", now);
  
            noteScores[expected.note] = Math.max(-10, noteScores[expected.note] - decrementScore);
            notesWrong[expected.note] += 1;
            hotStreak = 0;
            hotStreakOn = false;
            if (checkScoresForLoss()) {
              pauseBeat();
              setTimeout(() => {
                youLose = true;
                stopBeat();
              }, 1000)
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
      createExpectedNotes();
      scheduleExpectedNotes();
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
    // 2️⃣ Stop and dispose loops
    if (beatLoop) { beatLoop.stop(); }
    if (hatLoop) { hatLoop.stop(); }


    // 6️⃣ Reset your state
    resetGame = true;
    beatOn = false;
    paused = false;

    expectedNotes = [];
    hotStreak = 0;
    hotStreakOn = false;
    gameOn = false;
    introOn = false;
    borderOn = false;
    scheduleRepeat = null;
    console.log("Beat fully stopped and reset.");
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
            if (hotStreak > 7 && hotStreak % 4 == 0) {
              hotStreakOn = true;
              for (let key in noteScores) {
                noteScores[key] = Math.min(10, noteScores[key] + 1 + (hotStreak / 16));
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
            noteScores[expected.note] = Math.max(-10, noteScores[expected.note] - decrementScore);
            notesWrong[expected.note] += 1;
            hotStreak = 0;
            hotStreakOn = false;
            if (checkScoresForLoss()) {
              pauseBeat();
              setTimeout(() => {
                youLose = true;
                stopBeat();
              }, 1000)
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
      if (noteScores[key] <= -10) return true;
    }
    return false;
  }

  const notesDisplay = [
  { note: 60, label: "Do", left: "3%" },
  { note: 62, label: "Re", left: "16%" },
  { note: 64, label: "Mi", left: "28%" },
  { note: 65, label: "Fa", left: "40%" },
  { note: 67, label: "So", left: "52%" }
];

  function statTotals() {
    let totalCorrect = 0;
    let totalWrong = 0;
    for (let key in notesCorrect) {
      totalCorrect += notesCorrect[key];
      totalWrong += notesWrong[key];
    }
    return {correct: totalCorrect, wrong: totalWrong};
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
      <div
        class="rounded-full bg-green-300 flex justify-center items-center w-8 h-8 absolute transition-all duration-700 ease-in-out -translate-y-2/4"
        style="left: {n.left}; top: {50 - 5 * noteScores[n.note]}%"
        class:outline-4={hotStreakOn}
        class:outline-orange-400={hotStreakOn}
      >
        {n.label}
      </div>
    {/each}
  </div>
  <Keyboard
    onKeyDown={synth ? noteOn : () => {}}
    onKeyUp={synth ? noteOff : () => {}}
    {pressed}
  />

  {#if youWon || youLose}
  <div class="text-2xl absolute z-50 w-[90%] top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 bg-green-800 text-slate-200 border border-slate-200 flex flex-col justify-around items-center">
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
    {#each notesDisplay as n}
    <div class="my-1">{n.label} : {notesCorrect[n.note]}/{notesCorrect[n.note] + notesWrong[n.note]} -- {(notesCorrect[n.note]/(notesCorrect[n.note] + notesWrong[n.note]) * 100).toFixed(1)}%</div>
    {/each}
    <div class="my-2">Total: {statTotals().correct}/{statTotals().wrong + statTotals().correct} -- {(statTotals().correct / (statTotals().wrong + statTotals().correct) * 100).toFixed(1)}%</div>
  </div>
  {/if}
</div>