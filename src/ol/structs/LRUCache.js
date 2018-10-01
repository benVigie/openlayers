/**
 * @module ol/structs/LRUCache
 */

import {assert} from '../asserts.js';
import EventTarget from '../events/Target.js';
import EventType from '../events/EventType.js';


/**
 * @typedef {Object} Entry
 * @property {string} key_
 * @property {Object} newer
 * @property {Object} older
 * @property {*} value_
 */


/**
 * @classdesc
 * Implements a Least-Recently-Used cache where the keys do not conflict with
 * Object's properties (e.g. 'hasOwnProperty' is not allowed as a key). Expiring
 * items from the cache is the responsibility of the user.
 *
 * @fires import("../events/Event.js").Event
 * @template T
 */
class LRUCache extends EventTarget {

  /**
   * @param {number=} opt_highWaterMark High water mark.
   */
  constructor(opt_highWaterMark) {

    super();

    /**
     * @type {number}
     */
    this.highWaterMark = opt_highWaterMark !== undefined ? opt_highWaterMark : 2048;

    /**
     * @private
     * @type {number}
     */
    this.count_ = 0;

    /**
     * @private
     * @type {!Object<string, Entry>}
     */
    this.entries_ = {};

    /**
     * @private
     * @type {?Entry}
     */
    this.oldest_ = null;

    /**
     * @private
     * @type {?Entry}
     */
    this.newest_ = null;

  }


  /**
   * @return {boolean} Can expire cache.
   */
  canExpireCache() {
    return this.getCount() > this.highWaterMark;
  }


  /**
   * FIXME empty description for jsdoc
   */
  clear() {
    this.count_ = 0;
    this.entries_ = {};
    this.oldest_ = null;
    this.newest_ = null;
    this.dispatchEvent(EventType.CLEAR);
  }


  /**
   * @param {string} key Key.
   * @return {boolean} Contains key.
   */
  containsKey(key) {
    return this.entries_.hasOwnProperty(key);
  }


  /**
   * @param {function(this: S, T, string, LRUCache): ?} f The function
   *     to call for every entry from the oldest to the newer. This function takes
   *     3 arguments (the entry value, the entry key and the LRUCache object).
   *     The return value is ignored.
   * @param {S=} opt_this The object to use as `this` in `f`.
   * @template S
   */
  forEach(f, opt_this) {
    let entry = this.oldest_;
    while (entry) {
      f.call(opt_this, entry.value_, entry.key_, this);
      entry = entry.newer;
    }
  }


  /**
   * @param {string} key Key.
   * @return {T} Value.
   */
  get(key) {
    const entry = this.entries_[key];
    assert(entry !== undefined,
      15); // Tried to get a value for a key that does not exist in the cache
    if (entry === this.newest_) {
      return entry.value_;
    } else if (entry === this.oldest_) {
      this.oldest_ = /** @type {Entry} */ (this.oldest_.newer);
      this.oldest_.older = null;
    } else {
      entry.newer.older = entry.older;
      entry.older.newer = entry.newer;
    }
    entry.newer = null;
    entry.older = this.newest_;
    this.newest_.newer = entry;
    this.newest_ = entry;
    return entry.value_;
  }


  /**
   * Remove an entry from the cache.
   * @param {string} key The entry key.
   * @return {T} The removed entry.
   */
  remove(key) {
    const entry = this.entries_[key];
    assert(entry !== undefined, 15); // Tried to get a value for a key that does not exist in the cache
    if (entry === this.newest_) {
      this.newest_ = /** @type {Entry} */ (entry.older);
      if (this.newest_) {
        this.newest_.newer = null;
      }
    } else if (entry === this.oldest_) {
      this.oldest_ = /** @type {Entry} */ (entry.newer);
      if (this.oldest_) {
        this.oldest_.older = null;
      }
    } else {
      entry.newer.older = entry.older;
      entry.older.newer = entry.newer;
    }
    delete this.entries_[key];
    --this.count_;
    return entry.value_;
  }


  /**
   * @return {number} Count.
   */
  getCount() {
    return this.count_;
  }


  /**
   * @return {Array<string>} Keys.
   */
  getKeys() {
    const keys = new Array(this.count_);
    let i = 0;
    let entry;
    for (entry = this.newest_; entry; entry = entry.older) {
      keys[i++] = entry.key_;
    }
    return keys;
  }


  /**
   * @return {Array<T>} Values.
   */
  getValues() {
    const values = new Array(this.count_);
    let i = 0;
    let entry;
    for (entry = this.newest_; entry; entry = entry.older) {
      values[i++] = entry.value_;
    }
    return values;
  }


  /**
   * @return {T} Last value.
   */
  peekLast() {
    return this.oldest_.value_;
  }


  /**
   * @return {string} Last key.
   */
  peekLastKey() {
    return this.oldest_.key_;
  }


  /**
   * Get the key of the newest item in the cache.  Throws if the cache is empty.
   * @return {string} The newest key.
   */
  peekFirstKey() {
    return this.newest_.key_;
  }


  /**
   * @return {T} value Value.
   */
  pop() {
    const entry = this.oldest_;
    delete this.entries_[entry.key_];
    if (entry.newer) {
      entry.newer.older = null;
    }
    this.oldest_ = /** @type {Entry} */ (entry.newer);
    if (!this.oldest_) {
      this.newest_ = null;
    }
    --this.count_;
    return entry.value_;
  }


  /**
   * @param {string} key Key.
   * @param {T} value Value.
   */
  replace(key, value) {
    this.get(key); // update `newest_`
    this.entries_[key].value_ = value;
  }


  /**
   * @param {string} key Key.
   * @param {T} value Value.
   */
  set(key, value) {
    assert(!(key in this.entries_),
      16); // Tried to set a value for a key that is used already
    const entry = /** @type {Entry} */ ({
      key_: key,
      newer: null,
      older: this.newest_,
      value_: value
    });
    if (!this.newest_) {
      this.oldest_ = entry;
    } else {
      this.newest_.newer = entry;
    }
    this.newest_ = entry;
    this.entries_[key] = entry;
    ++this.count_;
  }


  /**
   * Set a maximum number of entries for the cache.
   * @param {number} size Cache size.
   * @api
   */
  setSize(size) {
    this.highWaterMark = size;
  }


  /**
   * Prune the cache.
   */
  prune() {
    while (this.canExpireCache()) {
      this.pop();
    }
  }

}

export default LRUCache;
