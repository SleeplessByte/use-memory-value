import localForage from 'localforage';
import {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import isEqual from 'react-fast-compare';

import { disableWarnings, warn } from './log';
export { disableWarnings };

const globals: { current: LocalForage } = { current: localForage };

/**
 * Allows you to override the local forage instance that is used. Normally it
 * will use the default "global" one.
 * @param instance
 */
export function setLocalForageInstance(instance: LocalForage) {
  globals.current = instance;
}

export type Serializable =
  | boolean
  | number
  | string
  | null
  | SerializableArray
  | ReadonlySerializableArray
  | SerializableMap;

interface SerializableMap {
  [key: string]: Serializable | undefined;
}
interface SerializableArray extends Array<Serializable | undefined> {}
interface ReadonlySerializableArray
  extends ReadonlyArray<Serializable | undefined> {}

export type Unsubscribe = () => void;
export type Listener<T extends Serializable> = (
  value: Readonly<AnyValue<T>>
) => Promise<unknown> | void;

export type UndeterminedValue = undefined;
export type NoValue = null;
export type Update<T extends Serializable> = Dispatch<
  SetStateAction<AnyValue<T> | undefined>
>;
export type AnyValue<T extends Serializable> = T | UndeterminedValue;

export interface AnyMemoryValue<T extends Serializable> {
  current: AnyValue<T>;
  subscribe(listener: Listener<T>, emit?: boolean): Unsubscribe;
  unsubscribe(listener: Listener<T>): void;
  emit(
    value: AnyValue<T>,
    store?: boolean,
    newOnly?: boolean
  ): Promise<AnyValue<T>>;
}
export class MemoryValue<T extends Serializable> implements AnyMemoryValue<T> {
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

  async emit(
    value: T | undefined,
    _store: boolean = false,
    newOnly: boolean = true
  ) {
    if (newOnly && isEqual(this.value, value)) {
      return value;
    }

    this.value = value;
    await Promise.all(this.listeners.map(async (listener) => listener(value)));
    return value;
  }
}

export class StoredMemoryValue<T extends Serializable>
  implements AnyMemoryValue<T | NoValue> {
  private value: MemoryValue<T | NoValue>;

  constructor(
    private storageKey: string,
    hydrate: boolean = true,
    initial?: Readonly<T>
  ) {
    this.value = new MemoryValue<T | NoValue>(initial);

    this.storageKey = storageKey;

    if (hydrate) {
      this.hydrate();
    }
  }

  public get current(): T | null | undefined {
    return this.value.current;
  }

  public subscribe(listener: Listener<T | NoValue>, emit: boolean = true) {
    return this.value.subscribe(listener, emit);
  }

  public unsubscribe(listener: Listener<T | NoValue>) {
    return this.value.unsubscribe(listener);
  }

  public async emit(
    value: T | null | undefined,
    store: boolean = true,
    newOnly: boolean = true
  ): Promise<AnyValue<T> | null> {
    if (newOnly && isEqual(value, this.current)) {
      return value;
    }

    if (store) {
      await this.write(value);
    }

    return this.value.emit(value, false, false);
  }

  public async hydrate() {
    return globals.current.getItem(this.storageKey).then(
      (value: any) => {
        if (value) {
          return this.emit(value, false);
        } else {
          return this.emit(null, false);
        }
      },
      (error) => {
        warn(error);
        return this.value;
      }
    );
  }

  /**
   * Write the new value. Don't call this directly, use emit instead.
   *
   * A few values have special meaning:
   * - null: writes null to the storage
   * - undefined: removes this completely from storage
   */
  private async write(storable: T | null | undefined): Promise<unknown> {
    if (storable === undefined) {
      return this.clear();
    }

    return globals.current.setItem(this.storageKey, storable).catch(warn);
  }

  /**
   * Remove this completely from storage. Don't call this directly, use
   * emit(undefined) instead.
   */
  private async clear(): Promise<unknown> {
    return globals.current.removeItem(this.storageKey).catch(warn);
  }
}

export function useMemoryValue<T extends Serializable>(
  value: AnyMemoryValue<T>
): Readonly<AnyValue<T>> {
  return useMutableMemoryValue(value)[0];
}

export function useMemoryRef<T extends Serializable>(
  value: AnyMemoryValue<T>
): RefObject<AnyValue<T>> {
  return useMutableMemoryRef(value);
}

export function useMutableMemoryValue<T extends Serializable>(
  value: AnyMemoryValue<T>
): [Readonly<AnyValue<T>>, Update<T>] {
  const [state, setState] = useState<AnyValue<T>>(value.current);

  const update = useCallback(
    (nextValue: AnyValue<T> | ((prev: AnyValue<T>) => AnyValue<T>)) => {
      if (nextValue instanceof Function || typeof nextValue === 'function') {
        value.emit(nextValue(value.current));
      } else {
        value.emit(nextValue);
      }
    },
    [value]
  );

  useLayoutEffect(() => {
    return value.subscribe(setState);
  }, [value, setState]);

  return [state, update];
}

export function useMutableMemoryRef<T extends Serializable>(
  value: AnyMemoryValue<T>
): MutableRefObject<AnyValue<T>> {
  const ref = useRef(value.current);

  const mutableRef = useMemo(() => {
    return Object.freeze({
      get current() {
        return ref.current;
      },

      set current(next: AnyValue<T>) {
        value.emit(next);
        ref.current = next;
      },
    });
  }, [ref]);

  useLayoutEffect(() => {
    return value.subscribe((value) => {
      ref.current = value;
    });
  }, [value, ref]);

  return mutableRef;
}
