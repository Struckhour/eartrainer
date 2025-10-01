import { writable, type Writable } from "svelte/store";
import { browser } from "$app/environment";

export function localStorageStore<T>(key: string, initial: T): Writable<T> {
  const store = writable<T>(initial);

  if (browser) {
    const stored = localStorage.getItem(key);
    if (stored) {
      store.set(JSON.parse(stored));
    }

    store.subscribe((val) => {
      localStorage.setItem(key, JSON.stringify(val));
    });
  }

  return store;
}

