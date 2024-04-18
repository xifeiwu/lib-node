# Intro

Implementation of memcached client and server.

# Reference Projects

[memcached](https://github.com/3rd-Eden/memcached)
[nodecached](https://github.com/alexfernandez/nodecached)

# Protocol

[memcached protocol](https://github.com/memcached/memcached/blob/master/doc/protocol.txt)
[memcached commands](https://github.com/memcached/memcached/wiki/Commands)

Storage commands
----------------

<command name> <key> <flags> <exptime> <bytes> [noreply]\r\n
cas <key> <flags> <exptime> <bytes> <cas unique> [noreply]\r\n

- <command name> is "set", "add", "replace", "append" or "prepend"

  "set" means "store this data".

  "add" means "store this data, but only if the server *doesn't* already
  hold data for this key".

  "replace" means "store this data, but only if the server *does*
  already hold data for this key".

  "append" means "add this data to an existing key after existing data".

  "prepend" means "add this data to an existing key before existing data".

  The append and prepend commands do not accept flags or exptime.
  They update existing data portions, and ignore new flag and exptime
  settings.

  "cas" is a check and set operation which means "store this data but
  only if no one else has updated since I last fetched it."

- <key> is the key under which the client asks to store the data

- <flags> is an arbitrary 16-bit unsigned integer (written out in
  decimal) that the server stores along with the data and sends back
  when the item is retrieved. Clients may use this as a bit field to
  store data-specific information; this field is opaque to the server.
  Note that in memcached 1.2.1 and higher, flags may be 32-bits, instead
  of 16, but you might want to restrict yourself to 16 bits for
  compatibility with older versions.

- <exptime> is expiration time. If it's 0, the item never expires
  (although it may be deleted from the cache to make place for other
  items). If it's non-zero (either Unix time or offset in seconds from
  current time), it is guaranteed that clients will not be able to
  retrieve this item after the expiration time arrives (measured by
  server time). If a negative value is given the item is immediately
  expired.

- <bytes> is the number of bytes in the data block to follow, *not*
  including the delimiting \r\n. <bytes> may be zero (in which case
  it's followed by an empty data block).

- <cas unique> is a unique 64-bit value of an existing entry.
  Clients should use the value returned from the "gets" command
  when issuing "cas" updates.

- "noreply" optional parameter instructs the server to not send the
  reply.  NOTE: if the request line is malformed, the server can't
  parse "noreply" option reliably.  In this case it may send the error
  to the client, and not reading it on the client side will break
  things.  Client should construct only valid requests.

After this line, the client sends the data block:

<data block>\r\n

- <data block> is a chunk of arbitrary 8-bit data of length <bytes>
  from the previous line.

After sending the command line and the data block the client awaits
the reply, which may be:

- "STORED\r\n", to indicate success.

- "NOT_STORED\r\n" to indicate the data was not stored, but not
because of an error. This normally means that the
condition for an "add" or a "replace" command wasn't met.

- "EXISTS\r\n" to indicate that the item you are trying to store with
a "cas" command has been modified since you last fetched it.

- "NOT_FOUND\r\n" to indicate that the item you are trying to store
with a "cas" command did not exist.
