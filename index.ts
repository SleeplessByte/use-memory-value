import localForage from 'localforage';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';
import isEqual from 'react-fast-compare';

const globals: { current: LocalForage } = { current: localForage };

/**
 * Allows you to override the local forage instance that is used. Normally it
 * will use the default "global" one.
 * @param instance
 */
export function setLocalForageInstance(instance: LocalForage) {
  globals.current = instance;
}

export type Unsubscribe = () => void;
export type Listener<T> = (value: Readonly<AnyValue<T>>) => void;

export type UndeterminedValue = undefined;
export type NoValue = null;
export type AnyValue<T> = T | UndeterminedValue;
export type Update<T> = Dispatch<SetStateAction<AnyValue<T>>>;

export interface AnyMemoryValue<T> {
  current: AnyValue<T>;
  subscribe(listener: Listener<T>, emit?: boolean): Unsubscribe;
  unsubscribe(listener: Listener<T>): void;
  emit(value: AnyValue<T>, store?: boolean, newOnly?: boolean): void;
}

export class MemoryValue<T> implements AnyMemoryValue<T> {
  private listeners: Listener<T>[];
  private value: T | undefined;

  constructor(initial?: Readonly<T>) {
    this.listeners = [];
    this.value = initial;
  }

  get current(): T | undefined {
    return this.value;
  }

  subscribe(listener: Listener<T>, emit: boolean = true): Unsubscribe {
    if (this.value !== undefined && emit) {
      listener(this.value);
    }

    this.listeners.push(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: Listener<T>) {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  emit(value: T | undefined, _store: boolean = false, newOnly: boolean = true) {
    if (newOnly && isEqual(this.value, value)) {
      return;
    }

    this.value = value;
    this.listeners.forEach((listener) => listener(value));
  }
}

export class StoredMemoryValue<T> implements AnyMemoryValue<T | NoValue> {
  private value: MemoryValue<T | NoValue>;

  constructor(
    private storageKey: string,
    hydrate: boolean = true,
    initial?: Readonly<T>
  ) {
    this.value = new MemoryValue<T | NoValue>(initial);

    this.storageKey = storageKey;

    if (hydrate) {
      this.read();
    }
  }

  get current(): T | null | undefined {
    return this.value.current;
  }

  subscribe(listener: Listener<T | NoValue>, emit: boolean = true) {
    return this.value.subscribe(listener, emit);
  }

  unsubscribe(listener: Listener<T | NoValue>) {
    return this.value.unsubscribe(listener);
  }

  emit(
    value: T | null | undefined,
    store: boolean = true,
    newOnly: boolean = true
  ) {
    if (newOnly && isEqual(value, this.current)) {
      return Promise.resolve(value);
    }

    this.value.emit(value, false, false);

    if (!store) {
      return value;
    }

    return this.write(value);
  }

  private read(): Promise<T | null> {
    return globals.current.getItem(this.storageKey).then((stored: any) => {
      if (stored) {
        this.emit(stored, false);
        return stored;
      } else {
        this.emit(null, false);
        return null;
      }
    });
  }

  private write(storable: T | null | undefined): Promise<unknown> {
    if (storable === undefined) {
      return this.clear();
    }

    return globals.current.setItem(this.storageKey, storable);
  }

  private clear(): Promise<unknown> {
    return globals.current.removeItem(this.storageKey);
  }
}

export function useMemoryValue<T>(
  value: AnyMemoryValue<T>
): Readonly<AnyValue<T>> {
  return useMutableMemoryValue(value)[0];
}

export function useMutableMemoryValue<T>(
  value: AnyMemoryValue<T>
): [Readonly<AnyValue<T>>, Update<T>] {
  const [state, setState] = useState<AnyValue<T>>(value.current);

  const update = useCallback(
    (nextValue: AnyValue<T> | ((prev: AnyValue<T>) => AnyValue<T>)) => {
      if (nextValue instanceof Function) {
        value.emit(nextValue(value.current));
      } else {
        value.emit(nextValue);
      }
    },
    [value]
  );

  useEffect(() => {
    return value.subscribe(setState);
  }, [value, setState]);

  return [state, update];
}
