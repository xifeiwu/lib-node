# Process memory fields (`getProcessInfo`, `ProcessInfo`)

This note summarizes how **`rss`**, **`vsize`**, **`rssWord`**, and **`vsizeWord`** relate to “memory usage,” and how that compares to macOS Activity Monitor vs Linux (e.g. CentOS).

## RSS vs VSZ (`vsize`)

- **RSS (resident set size):** Roughly how much **physical RAM** is **currently resident** for the process: pages that are in RAM (your heap/stack/data that are touched, and your share of resident shared mappings, per how the kernel/`ps` reports it).
- **VSZ / `vsize` (virtual size):** The **size of the process’s virtual address space**: mappings for code, heap, stack, `mmap`, shared libraries, etc. It includes regions **not** in RAM (never faulted, swapped out, etc.). It is usually **much larger than RSS** and is **not** “bytes of DRAM in use.”

So: **RSS ≈ “how much is in RAM” (classic sense)**; **VSZ ≈ “how big is the address space.”**

## How `getProcessInfo` builds `rssWord` / `vsizeWord`

- For rows from **`ps`**, numeric **`rss`** and **`vsize`** are treated as **1024-byte units** (per typical `ps` documentation, e.g. Darwin `man ps` for `rss`; `vsize`/`vsz` as Kbytes).
- Those are converted to **bytes** (`× 1024`) and passed through **`byteToWord`** for **`rssWord`** / **`vsizeWord`**.
- For **`getProcessInfoByInst`**, Node’s **`process.memoryUsage().rss()`** is already **bytes**; **`vsize`** may be `0` there unless filled elsewhere.

## macOS: why `rssWord` ≠ Activity Monitor “Memory”

- **`rss` / `rssWord` follow `ps` RSS** (resident set in **1024-byte units** on Darwin per `man ps`). The **`× 1024`** step is consistent with that definition.
- **Activity Monitor’s “Memory”** is **not** the same metric. Apple uses **kernel-style “physical footprint”** accounting (compression, purgeable/tagged memory, how shared memory is charged, etc.). It is often **larger** than `ps` RSS for the same process; a large ratio (e.g. ~5×) can be normal.
- **There is no correct single multiplier** on `ps` RSS to match Activity Monitor; matching AM would need **Mach `task_info`** (native code) or tools like **`vmmap`**, not `ps` alone.

### Which is “actual” memory?

- **“Actual” in the `ps` / Unix sense** → **`ps` RSS** → your **`rssWord`** (for `getProcessInfo` rows from `ps`).
- **“Actual” in Apple’s UI / pressure sense** → closer to **Activity Monitor’s “Memory”** (different definition on purpose).

Neither is a complete model of every kind of resource (GPU, page cache elsewhere, etc.).

## Linux (e.g. CentOS / RHEL-style)

- **`procps-ng`** `ps` **`rss`** is typically **resident set in KiB**; **`× 1024` → bytes → `byteToWord`** is the usual reading and aligns with **`/proc/<pid>/status` `VmRSS`** (kB) and **`top` / `htop` RES** in the same ballpark (small differences from sampling).
- **`VSZ` / `vsize`** remains **virtual size**, not “RAM used.”
- **Caveat:** Minimal/container images may use **BusyBox `ps`**, which can differ; for strict consistency, **`/proc/<pid>/status`** is a good ground truth on Linux.

## References in code

- Types and intent: `modules/lib/node/types/process.ts` (`ProcessInfo`, especially `rss`, `rssWord`).
- Implementation and remarks: `modules/lib/node/process/service/info.ts` (`withMemoryWordFields`, `getProcessInfo`).
