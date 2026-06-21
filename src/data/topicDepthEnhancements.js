const exactEnhancements = {
  "python-asyncio": "\n## Asyncio event loop and runners\n\n`asyncio` is Python's standard-library framework for single-threaded cooperative concurrency. It is not magic parallelism. One event loop runs many tasks, and each task voluntarily gives control back to the loop whenever it reaches an `await` on non-blocking work.\n\n```text\nasyncio.run(main())\n  -> creates an event loop\n  -> runs main coroutine\n  -> schedules tasks/futures\n  -> resumes tasks when awaited I/O/timers complete\n  -> cancels remaining tasks during shutdown\n  -> closes loop\n```\n\n### Runner APIs\n\n| API | Use it for | Example |\n|---|---|---|\n| `asyncio.run(coro)` | Normal top-level entry point for scripts | `asyncio.run(main())` |\n| `asyncio.Runner()` | Reuse one loop across multiple top-level calls | tests, embedded runners |\n| `asyncio.get_running_loop()` | Access the currently running loop inside async code | scheduling callbacks, executor work |\n| `asyncio.new_event_loop()` | Low-level manual loop creation | rare framework code |\n| `asyncio.set_event_loop(loop)` | Bind a loop manually | rare/legacy cases |\n\n```python\nimport asyncio\n\nasync def main():\n    loop = asyncio.get_running_loop()\n    print(type(loop).__name__)\n\nasyncio.run(main())\n```\n\nUse `asyncio.run()` once at the edge of the program. Do not call it from inside an already-running event loop, such as inside FastAPI handlers or Jupyter notebooks.\n\n## Asyncio coroutines, tasks, and futures\n\nA coroutine is the lazy result of calling an `async def` function. It does not run until awaited or wrapped in a task.\n\n```python\nasync def fetch_user(user_id: int):\n    await asyncio.sleep(0.1)\n    return {\"id\": user_id}\n\ncoro = fetch_user(1)       # coroutine object; not executed yet\nresult = await coro        # now it runs\n```\n\nA task schedules a coroutine to run concurrently on the loop.\n\n```python\nasync def main():\n    task = asyncio.create_task(fetch_user(1))\n    # other work can happen here\n    user = await task\n    print(user)\n```\n\n| Concept | Meaning | When you use it |\n|---|---|---|\n| Coroutine | Awaitable computation created by `async def` | Direct `await` calls |\n| Task | Scheduled coroutine managed by the event loop | Concurrent work |\n| Future | Placeholder for a result that will exist later | Low-level integrations |\n| Awaitable | Anything usable with `await` | coroutine/task/future/custom awaitable |\n\n## Asyncio task APIs\n\n### `asyncio.create_task()`\n\nUse it when independent work should start now and finish later.\n\n```python\nasync def send_email():\n    await asyncio.sleep(1)\n    return \"sent\"\n\nasync def main():\n    task = asyncio.create_task(send_email(), name=\"email-task\")\n    print(\"task scheduled\")\n    result = await task\n    print(result)\n```\n\nTrack created tasks. A fire-and-forget task can fail silently if you never await or inspect it.\n\n```python\nbackground_tasks = set()\n\ndef spawn(coro):\n    task = asyncio.create_task(coro)\n    background_tasks.add(task)\n    task.add_done_callback(background_tasks.discard)\n    return task\n```\n\n### `asyncio.TaskGroup()`\n\nUse `TaskGroup` for structured concurrency: child tasks belong to a scope. If one task fails, the group cancels the rest and raises an exception group.\n\n```python\nasync def call_api(name, delay):\n    await asyncio.sleep(delay)\n    return name\n\nasync def main():\n    async with asyncio.TaskGroup() as tg:\n        a = tg.create_task(call_api(\"users\", 0.2))\n        b = tg.create_task(call_api(\"orders\", 0.1))\n\n    print(a.result(), b.result())\n```\n\n### `asyncio.gather()`\n\nUse `gather()` when you want ordered results from many awaitables.\n\n```python\nresults = await asyncio.gather(\n    fetch_user(1),\n    fetch_user(2),\n    fetch_user(3),\n)\n```\n\nBy default, one exception makes `gather()` raise. With `return_exceptions=True`, exceptions become result values, which is useful for bulk processing where partial failures are acceptable.\n\n```python\nresults = await asyncio.gather(*calls, return_exceptions=True)\nfor item in results:\n    if isinstance(item, Exception):\n        print(\"failed\", item)\n```\n\n### `asyncio.wait()`\n\nUse `wait()` when you need separate `done` and `pending` sets.\n\n```python\ndone, pending = await asyncio.wait(tasks, timeout=2)\nfor task in pending:\n    task.cancel()\n```\n\n### `asyncio.as_completed()`\n\nUse it when result order should follow completion order, not input order.\n\n```python\nfor future in asyncio.as_completed(tasks):\n    result = await future\n    print(\"first available result\", result)\n```\n\n## Asyncio timeouts and cancellation\n\nCancellation is normal control flow in async systems. Timeouts, shutdowns, client disconnects, and task group failures all use cancellation.\n\n| API | Use |\n|---|---|\n| `task.cancel()` | Request task cancellation |\n| `asyncio.CancelledError` | Raised inside a cancelled task |\n| `asyncio.timeout(seconds)` | Timeout block/context |\n| `asyncio.wait_for(awaitable, timeout)` | Timeout one awaitable |\n| `asyncio.shield(awaitable)` | Prevent outer cancellation from cancelling inner awaitable |\n\n```python\nasync def download_report():\n    try:\n        await asyncio.sleep(10)\n        return \"report\"\n    except asyncio.CancelledError:\n        print(\"cleanup before cancellation\")\n        raise\n\nasync def main():\n    try:\n        async with asyncio.timeout(2):\n            await download_report()\n    except TimeoutError:\n        print(\"too slow\")\n```\n\nUse `shield()` carefully. It is useful when a cleanup or commit must finish even if the caller times out.\n\n```python\nawait asyncio.shield(write_audit_log())\n```\n\n## Asyncio queues and producer-consumer workflows\n\n`asyncio.Queue` is the cleanest pattern when producers and workers run concurrently.\n\n| API | Meaning |\n|---|---|\n| `asyncio.Queue(maxsize=0)` | FIFO queue; optional backpressure |\n| `await queue.put(item)` | Add item; waits if full |\n| `await queue.get()` | Take item; waits if empty |\n| `queue.task_done()` | Mark one item as processed |\n| `await queue.join()` | Wait until all queued items are processed |\n| `asyncio.PriorityQueue()` | Lower priority values come first |\n| `asyncio.LifoQueue()` | Stack behavior |\n\n```python\nimport asyncio\n\nasync def producer(queue):\n    for i in range(10):\n        await queue.put(i)\n    for _ in range(3):\n        await queue.put(None)  # sentinel for workers\n\nasync def worker(name, queue):\n    while True:\n        item = await queue.get()\n        try:\n            if item is None:\n                return\n            await asyncio.sleep(0.1)\n            print(name, \"processed\", item)\n        finally:\n            queue.task_done()\n\nasync def main():\n    queue = asyncio.Queue(maxsize=5)\n    workers = [asyncio.create_task(worker(f\"w{i}\", queue)) for i in range(3)]\n    await producer(queue)\n    await queue.join()\n    await asyncio.gather(*workers)\n```\n\nUse `maxsize` to avoid memory growth when producers are faster than consumers.\n\n## Asyncio synchronization primitives\n\n| Primitive | Use |\n|---|---|\n| `asyncio.Lock()` | One task at a time enters a critical section |\n| `asyncio.Event()` | One task signals many waiting tasks |\n| `asyncio.Condition()` | Wait until shared state satisfies a condition |\n| `asyncio.Semaphore(n)` | Limit concurrent access to a resource |\n| `asyncio.BoundedSemaphore(n)` | Semaphore that catches over-release bugs |\n| `asyncio.Barrier(n)` | Wait until N tasks reach the same point |\n\n### Lock\n\n```python\nlock = asyncio.Lock()\ncounter = 0\n\nasync def increment():\n    global counter\n    async with lock:\n        current = counter\n        await asyncio.sleep(0)\n        counter = current + 1\n```\n\n### Semaphore for API rate control\n\n```python\nsem = asyncio.Semaphore(10)\n\nasync def limited_fetch(url):\n    async with sem:\n        return await fetch(url)\n```\n\n### Event for startup readiness\n\n```python\nready = asyncio.Event()\n\nasync def initialize():\n    await load_config()\n    ready.set()\n\nasync def handle_request():\n    await ready.wait()\n    return \"ok\"\n```\n\n## Asyncio streams and network APIs\n\nStreams are high-level TCP helpers.\n\n| API | Use |\n|---|---|\n| `asyncio.open_connection(host, port)` | TCP client |\n| `asyncio.start_server(handler, host, port)` | TCP server |\n| `StreamReader.read(n)` | Read bytes |\n| `StreamReader.readline()` | Read one line |\n| `StreamWriter.write(data)` | Buffer bytes for writing |\n| `await StreamWriter.drain()` | Backpressure-aware flush |\n| `StreamWriter.close()` | Close writer |\n| `await StreamWriter.wait_closed()` | Wait for close |\n\n```python\nasync def tcp_client():\n    reader, writer = await asyncio.open_connection(\"example.com\", 80)\n    writer.write(b\"GET / HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n\")\n    await writer.drain()\n    data = await reader.read(1024)\n    writer.close()\n    await writer.wait_closed()\n    return data\n```\n\n## Asyncio subprocess APIs\n\nUse async subprocesses when a Python program needs to run external commands without blocking the loop.\n\n```python\nproc = await asyncio.create_subprocess_exec(\n    \"python\", \"--version\",\n    stdout=asyncio.subprocess.PIPE,\n    stderr=asyncio.subprocess.PIPE,\n)\nstdout, stderr = await proc.communicate()\nprint(proc.returncode, stdout.decode(), stderr.decode())\n```\n\n## Running blocking code safely\n\nAsync code becomes slow when blocking calls run on the event loop. Examples: `time.sleep`, `requests.get`, sync DB drivers, heavy CPU loops, large local file parsing.\n\n| API | Use |\n|---|---|\n| `asyncio.to_thread(func, *args)` | Run blocking function in a thread |\n| `loop.run_in_executor(executor, func, *args)` | Custom executor/thread/process pool |\n\n```python\nimport requests\n\nasync def fetch_with_requests(url):\n    return await asyncio.to_thread(requests.get, url, timeout=10)\n```\n\nFor CPU-heavy work, prefer a worker process, job queue, or service designed for that workload. `asyncio` is mostly for high-concurrency I/O.\n\n## Async context managers and async iterators\n\n### Async context manager\n\n```python\nclass AsyncSession:\n    async def __aenter__(self):\n        await self.open()\n        return self\n\n    async def __aexit__(self, exc_type, exc, tb):\n        await self.close()\n\n    async def open(self): ...\n    async def close(self): ...\n\nasync with AsyncSession() as session:\n    await session.query(\"select 1\")\n```\n\n### Async iterator\n\n```python\nclass AsyncRange:\n    def __init__(self, stop):\n        self.current = 0\n        self.stop = stop\n\n    def __aiter__(self):\n        return self\n\n    async def __anext__(self):\n        if self.current >= self.stop:\n            raise StopAsyncIteration\n        await asyncio.sleep(0.1)\n        self.current += 1\n        return self.current\n\nasync for number in AsyncRange(3):\n    print(number)\n```\n\n## Asyncio debugging and inspection\n\n| API / setting | Use |\n|---|---|\n| `asyncio.current_task()` | Current running task |\n| `asyncio.all_tasks()` | All not-yet-finished tasks in current loop |\n| `task.get_name()` | Human-readable task name |\n| `task.get_stack()` | Debug where a task is paused |\n| `PYTHONASYNCIODEBUG=1` | Enable asyncio debug mode |\n| `loop.set_debug(True)` | Enable debug mode programmatically |\n\n```python\nasync def dump_tasks():\n    for task in asyncio.all_tasks():\n        print(task.get_name(), task.done(), task.cancelled())\n```\n\n## Real project pattern: concurrent HTTP aggregation\n\n```python\nimport asyncio\nimport httpx\n\nasync def fetch_json(client, url):\n    response = await client.get(url, timeout=5)\n    response.raise_for_status()\n    return response.json()\n\nasync def aggregate(user_id):\n    async with httpx.AsyncClient() as client:\n        profile_url = f\"https://api.example.com/users/{user_id}\"\n        orders_url = f\"https://api.example.com/users/{user_id}/orders\"\n        profile, orders = await asyncio.gather(\n            fetch_json(client, profile_url),\n            fetch_json(client, orders_url),\n        )\n    return {\"profile\": profile, \"orders\": orders}\n```\n\n## Common asyncio failure cases\n\n| Mistake | What happens | Fix |\n|---|---|---|\n| Calling coroutine without `await` | Nothing runs; warning later | `await coro` or `create_task(coro)` |\n| `time.sleep()` in async function | Whole loop freezes | `await asyncio.sleep()` |\n| Sync DB/HTTP client in async route | Slow requests block each other | async driver or `to_thread` |\n| Not handling cancellation | dirty shutdown, leaked work | catch `CancelledError`, cleanup, re-raise |\n| Unbounded `gather()` on huge inputs | memory/socket exhaustion | semaphore, queue, batching |\n| Fire-and-forget task untracked | hidden exceptions | keep task references/log failures |\n\n## Asyncio interview explanation\n\n> Asyncio gives concurrency through an event loop and cooperative tasks. I use `asyncio.run()` at the program edge, `create_task()` or `TaskGroup` for concurrent work, `gather()` when I need ordered results, `as_completed()` when I want results as soon as they finish, queues for producer-consumer pipelines, semaphores for rate limits, and timeout/cancellation handling for production safety. It helps I/O-bound workloads; CPU-heavy work belongs in processes, workers, or separate services.\n",
  "source-fullstack-python-asyncio-from-scratch-to-interview-advanced": "\n## Asyncio event loop and runners\n\n`asyncio` is Python's standard-library framework for single-threaded cooperative concurrency. It is not magic parallelism. One event loop runs many tasks, and each task voluntarily gives control back to the loop whenever it reaches an `await` on non-blocking work.\n\n```text\nasyncio.run(main())\n  -> creates an event loop\n  -> runs main coroutine\n  -> schedules tasks/futures\n  -> resumes tasks when awaited I/O/timers complete\n  -> cancels remaining tasks during shutdown\n  -> closes loop\n```\n\n### Runner APIs\n\n| API | Use it for | Example |\n|---|---|---|\n| `asyncio.run(coro)` | Normal top-level entry point for scripts | `asyncio.run(main())` |\n| `asyncio.Runner()` | Reuse one loop across multiple top-level calls | tests, embedded runners |\n| `asyncio.get_running_loop()` | Access the currently running loop inside async code | scheduling callbacks, executor work |\n| `asyncio.new_event_loop()` | Low-level manual loop creation | rare framework code |\n| `asyncio.set_event_loop(loop)` | Bind a loop manually | rare/legacy cases |\n\n```python\nimport asyncio\n\nasync def main():\n    loop = asyncio.get_running_loop()\n    print(type(loop).__name__)\n\nasyncio.run(main())\n```\n\nUse `asyncio.run()` once at the edge of the program. Do not call it from inside an already-running event loop, such as inside FastAPI handlers or Jupyter notebooks.\n\n## Asyncio coroutines, tasks, and futures\n\nA coroutine is the lazy result of calling an `async def` function. It does not run until awaited or wrapped in a task.\n\n```python\nasync def fetch_user(user_id: int):\n    await asyncio.sleep(0.1)\n    return {\"id\": user_id}\n\ncoro = fetch_user(1)       # coroutine object; not executed yet\nresult = await coro        # now it runs\n```\n\nA task schedules a coroutine to run concurrently on the loop.\n\n```python\nasync def main():\n    task = asyncio.create_task(fetch_user(1))\n    # other work can happen here\n    user = await task\n    print(user)\n```\n\n| Concept | Meaning | When you use it |\n|---|---|---|\n| Coroutine | Awaitable computation created by `async def` | Direct `await` calls |\n| Task | Scheduled coroutine managed by the event loop | Concurrent work |\n| Future | Placeholder for a result that will exist later | Low-level integrations |\n| Awaitable | Anything usable with `await` | coroutine/task/future/custom awaitable |\n\n## Asyncio task APIs\n\n### `asyncio.create_task()`\n\nUse it when independent work should start now and finish later.\n\n```python\nasync def send_email():\n    await asyncio.sleep(1)\n    return \"sent\"\n\nasync def main():\n    task = asyncio.create_task(send_email(), name=\"email-task\")\n    print(\"task scheduled\")\n    result = await task\n    print(result)\n```\n\nTrack created tasks. A fire-and-forget task can fail silently if you never await or inspect it.\n\n```python\nbackground_tasks = set()\n\ndef spawn(coro):\n    task = asyncio.create_task(coro)\n    background_tasks.add(task)\n    task.add_done_callback(background_tasks.discard)\n    return task\n```\n\n### `asyncio.TaskGroup()`\n\nUse `TaskGroup` for structured concurrency: child tasks belong to a scope. If one task fails, the group cancels the rest and raises an exception group.\n\n```python\nasync def call_api(name, delay):\n    await asyncio.sleep(delay)\n    return name\n\nasync def main():\n    async with asyncio.TaskGroup() as tg:\n        a = tg.create_task(call_api(\"users\", 0.2))\n        b = tg.create_task(call_api(\"orders\", 0.1))\n\n    print(a.result(), b.result())\n```\n\n### `asyncio.gather()`\n\nUse `gather()` when you want ordered results from many awaitables.\n\n```python\nresults = await asyncio.gather(\n    fetch_user(1),\n    fetch_user(2),\n    fetch_user(3),\n)\n```\n\nBy default, one exception makes `gather()` raise. With `return_exceptions=True`, exceptions become result values, which is useful for bulk processing where partial failures are acceptable.\n\n```python\nresults = await asyncio.gather(*calls, return_exceptions=True)\nfor item in results:\n    if isinstance(item, Exception):\n        print(\"failed\", item)\n```\n\n### `asyncio.wait()`\n\nUse `wait()` when you need separate `done` and `pending` sets.\n\n```python\ndone, pending = await asyncio.wait(tasks, timeout=2)\nfor task in pending:\n    task.cancel()\n```\n\n### `asyncio.as_completed()`\n\nUse it when result order should follow completion order, not input order.\n\n```python\nfor future in asyncio.as_completed(tasks):\n    result = await future\n    print(\"first available result\", result)\n```\n\n## Asyncio timeouts and cancellation\n\nCancellation is normal control flow in async systems. Timeouts, shutdowns, client disconnects, and task group failures all use cancellation.\n\n| API | Use |\n|---|---|\n| `task.cancel()` | Request task cancellation |\n| `asyncio.CancelledError` | Raised inside a cancelled task |\n| `asyncio.timeout(seconds)` | Timeout block/context |\n| `asyncio.wait_for(awaitable, timeout)` | Timeout one awaitable |\n| `asyncio.shield(awaitable)` | Prevent outer cancellation from cancelling inner awaitable |\n\n```python\nasync def download_report():\n    try:\n        await asyncio.sleep(10)\n        return \"report\"\n    except asyncio.CancelledError:\n        print(\"cleanup before cancellation\")\n        raise\n\nasync def main():\n    try:\n        async with asyncio.timeout(2):\n            await download_report()\n    except TimeoutError:\n        print(\"too slow\")\n```\n\nUse `shield()` carefully. It is useful when a cleanup or commit must finish even if the caller times out.\n\n```python\nawait asyncio.shield(write_audit_log())\n```\n\n## Asyncio queues and producer-consumer workflows\n\n`asyncio.Queue` is the cleanest pattern when producers and workers run concurrently.\n\n| API | Meaning |\n|---|---|\n| `asyncio.Queue(maxsize=0)` | FIFO queue; optional backpressure |\n| `await queue.put(item)` | Add item; waits if full |\n| `await queue.get()` | Take item; waits if empty |\n| `queue.task_done()` | Mark one item as processed |\n| `await queue.join()` | Wait until all queued items are processed |\n| `asyncio.PriorityQueue()` | Lower priority values come first |\n| `asyncio.LifoQueue()` | Stack behavior |\n\n```python\nimport asyncio\n\nasync def producer(queue):\n    for i in range(10):\n        await queue.put(i)\n    for _ in range(3):\n        await queue.put(None)  # sentinel for workers\n\nasync def worker(name, queue):\n    while True:\n        item = await queue.get()\n        try:\n            if item is None:\n                return\n            await asyncio.sleep(0.1)\n            print(name, \"processed\", item)\n        finally:\n            queue.task_done()\n\nasync def main():\n    queue = asyncio.Queue(maxsize=5)\n    workers = [asyncio.create_task(worker(f\"w{i}\", queue)) for i in range(3)]\n    await producer(queue)\n    await queue.join()\n    await asyncio.gather(*workers)\n```\n\nUse `maxsize` to avoid memory growth when producers are faster than consumers.\n\n## Asyncio synchronization primitives\n\n| Primitive | Use |\n|---|---|\n| `asyncio.Lock()` | One task at a time enters a critical section |\n| `asyncio.Event()` | One task signals many waiting tasks |\n| `asyncio.Condition()` | Wait until shared state satisfies a condition |\n| `asyncio.Semaphore(n)` | Limit concurrent access to a resource |\n| `asyncio.BoundedSemaphore(n)` | Semaphore that catches over-release bugs |\n| `asyncio.Barrier(n)` | Wait until N tasks reach the same point |\n\n### Lock\n\n```python\nlock = asyncio.Lock()\ncounter = 0\n\nasync def increment():\n    global counter\n    async with lock:\n        current = counter\n        await asyncio.sleep(0)\n        counter = current + 1\n```\n\n### Semaphore for API rate control\n\n```python\nsem = asyncio.Semaphore(10)\n\nasync def limited_fetch(url):\n    async with sem:\n        return await fetch(url)\n```\n\n### Event for startup readiness\n\n```python\nready = asyncio.Event()\n\nasync def initialize():\n    await load_config()\n    ready.set()\n\nasync def handle_request():\n    await ready.wait()\n    return \"ok\"\n```\n\n## Asyncio streams and network APIs\n\nStreams are high-level TCP helpers.\n\n| API | Use |\n|---|---|\n| `asyncio.open_connection(host, port)` | TCP client |\n| `asyncio.start_server(handler, host, port)` | TCP server |\n| `StreamReader.read(n)` | Read bytes |\n| `StreamReader.readline()` | Read one line |\n| `StreamWriter.write(data)` | Buffer bytes for writing |\n| `await StreamWriter.drain()` | Backpressure-aware flush |\n| `StreamWriter.close()` | Close writer |\n| `await StreamWriter.wait_closed()` | Wait for close |\n\n```python\nasync def tcp_client():\n    reader, writer = await asyncio.open_connection(\"example.com\", 80)\n    writer.write(b\"GET / HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n\")\n    await writer.drain()\n    data = await reader.read(1024)\n    writer.close()\n    await writer.wait_closed()\n    return data\n```\n\n## Asyncio subprocess APIs\n\nUse async subprocesses when a Python program needs to run external commands without blocking the loop.\n\n```python\nproc = await asyncio.create_subprocess_exec(\n    \"python\", \"--version\",\n    stdout=asyncio.subprocess.PIPE,\n    stderr=asyncio.subprocess.PIPE,\n)\nstdout, stderr = await proc.communicate()\nprint(proc.returncode, stdout.decode(), stderr.decode())\n```\n\n## Running blocking code safely\n\nAsync code becomes slow when blocking calls run on the event loop. Examples: `time.sleep`, `requests.get`, sync DB drivers, heavy CPU loops, large local file parsing.\n\n| API | Use |\n|---|---|\n| `asyncio.to_thread(func, *args)` | Run blocking function in a thread |\n| `loop.run_in_executor(executor, func, *args)` | Custom executor/thread/process pool |\n\n```python\nimport requests\n\nasync def fetch_with_requests(url):\n    return await asyncio.to_thread(requests.get, url, timeout=10)\n```\n\nFor CPU-heavy work, prefer a worker process, job queue, or service designed for that workload. `asyncio` is mostly for high-concurrency I/O.\n\n## Async context managers and async iterators\n\n### Async context manager\n\n```python\nclass AsyncSession:\n    async def __aenter__(self):\n        await self.open()\n        return self\n\n    async def __aexit__(self, exc_type, exc, tb):\n        await self.close()\n\n    async def open(self): ...\n    async def close(self): ...\n\nasync with AsyncSession() as session:\n    await session.query(\"select 1\")\n```\n\n### Async iterator\n\n```python\nclass AsyncRange:\n    def __init__(self, stop):\n        self.current = 0\n        self.stop = stop\n\n    def __aiter__(self):\n        return self\n\n    async def __anext__(self):\n        if self.current >= self.stop:\n            raise StopAsyncIteration\n        await asyncio.sleep(0.1)\n        self.current += 1\n        return self.current\n\nasync for number in AsyncRange(3):\n    print(number)\n```\n\n## Asyncio debugging and inspection\n\n| API / setting | Use |\n|---|---|\n| `asyncio.current_task()` | Current running task |\n| `asyncio.all_tasks()` | All not-yet-finished tasks in current loop |\n| `task.get_name()` | Human-readable task name |\n| `task.get_stack()` | Debug where a task is paused |\n| `PYTHONASYNCIODEBUG=1` | Enable asyncio debug mode |\n| `loop.set_debug(True)` | Enable debug mode programmatically |\n\n```python\nasync def dump_tasks():\n    for task in asyncio.all_tasks():\n        print(task.get_name(), task.done(), task.cancelled())\n```\n\n## Real project pattern: concurrent HTTP aggregation\n\n```python\nimport asyncio\nimport httpx\n\nasync def fetch_json(client, url):\n    response = await client.get(url, timeout=5)\n    response.raise_for_status()\n    return response.json()\n\nasync def aggregate(user_id):\n    async with httpx.AsyncClient() as client:\n        profile_url = f\"https://api.example.com/users/{user_id}\"\n        orders_url = f\"https://api.example.com/users/{user_id}/orders\"\n        profile, orders = await asyncio.gather(\n            fetch_json(client, profile_url),\n            fetch_json(client, orders_url),\n        )\n    return {\"profile\": profile, \"orders\": orders}\n```\n\n## Common asyncio failure cases\n\n| Mistake | What happens | Fix |\n|---|---|---|\n| Calling coroutine without `await` | Nothing runs; warning later | `await coro` or `create_task(coro)` |\n| `time.sleep()` in async function | Whole loop freezes | `await asyncio.sleep()` |\n| Sync DB/HTTP client in async route | Slow requests block each other | async driver or `to_thread` |\n| Not handling cancellation | dirty shutdown, leaked work | catch `CancelledError`, cleanup, re-raise |\n| Unbounded `gather()` on huge inputs | memory/socket exhaustion | semaphore, queue, batching |\n| Fire-and-forget task untracked | hidden exceptions | keep task references/log failures |\n\n## Asyncio interview explanation\n\n> Asyncio gives concurrency through an event loop and cooperative tasks. I use `asyncio.run()` at the program edge, `create_task()` or `TaskGroup` for concurrent work, `gather()` when I need ordered results, `as_completed()` when I want results as soon as they finish, queues for producer-consumer pipelines, semaphores for rate limits, and timeout/cancellation handling for production safety. It helps I/O-bound workloads; CPU-heavy work belongs in processes, workers, or separate services.\n",
  "python-collections": "\n## Collections module API map\n\nThe `collections` module gives specialized containers that make Python code cleaner and faster for common data-shaping problems.\n\n| API | Best use | Tiny example |\n|---|---|---|\n| `Counter` | Frequencies, top-N counts, multiset math | `Counter(words).most_common(5)` |\n| `defaultdict` | Grouping without repeated key checks | `defaultdict(list)` |\n| `deque` | Queue/stack with fast left/right operations | `q.append(x); q.popleft()` |\n| `namedtuple` | Lightweight immutable record | `Point = namedtuple(\"Point\", \"x y\")` |\n| `OrderedDict` | Explicit order-sensitive dict behavior | LRU-like movement |\n| `ChainMap` | Layered config lookup | CLI > env > defaults |\n| `UserDict` | Safer custom dict wrapper | validation/instrumentation |\n| `UserList` | Safer custom list wrapper | custom list behavior |\n| `UserString` | Custom string-like object | normalization wrappers |\n\n## Counter methods and usage\n\n```python\nfrom collections import Counter\n\nwords = [\"api\", \"db\", \"api\", \"cache\"]\ncounts = Counter(words)\n\nprint(counts[\"api\"])              # 2\nprint(counts.most_common(2))       # [('api', 2), ('db', 1)]\ncounts.update([\"api\", \"queue\"])\ncounts.subtract([\"db\"])\nprint(+counts)                     # removes zero/negative counts\n```\n\nUse `Counter` for logs, tags, categories, inventory-like counting, and interview frequency problems.\n\n## defaultdict methods and usage\n\n```python\nfrom collections import defaultdict\n\norders_by_user = defaultdict(list)\nfor order in orders:\n    orders_by_user[order[\"user_id\"]].append(order)\n```\n\nCommon factories:\n\n```python\ndefaultdict(list)    # grouping\ndefaultdict(int)     # counting\ndefaultdict(set)     # unique grouped values\n```\n\nAvoid `defaultdict` when missing keys should be treated as bugs. In that case, a normal `dict` is clearer.\n\n## deque methods and usage\n\n```python\nfrom collections import deque\n\nq = deque(maxlen=3)\nq.append(\"a\")\nq.appendleft(\"start\")\nq.pop()\nq.popleft()\nq.extend([1, 2, 3])\nq.rotate(1)\n```\n\nUse `deque` for BFS, queues, sliding windows, recent-history buffers, and producer-consumer style code inside one process.\n\n```python\nwindow = deque(maxlen=5)\nfor value in stream:\n    window.append(value)\n    print(sum(window) / len(window))\n```\n",
  "source-fullstack-python-collections-module-deep-examples-and-api-map": "\n## Collections module API map\n\nThe `collections` module gives specialized containers that make Python code cleaner and faster for common data-shaping problems.\n\n| API | Best use | Tiny example |\n|---|---|---|\n| `Counter` | Frequencies, top-N counts, multiset math | `Counter(words).most_common(5)` |\n| `defaultdict` | Grouping without repeated key checks | `defaultdict(list)` |\n| `deque` | Queue/stack with fast left/right operations | `q.append(x); q.popleft()` |\n| `namedtuple` | Lightweight immutable record | `Point = namedtuple(\"Point\", \"x y\")` |\n| `OrderedDict` | Explicit order-sensitive dict behavior | LRU-like movement |\n| `ChainMap` | Layered config lookup | CLI > env > defaults |\n| `UserDict` | Safer custom dict wrapper | validation/instrumentation |\n| `UserList` | Safer custom list wrapper | custom list behavior |\n| `UserString` | Custom string-like object | normalization wrappers |\n\n## Counter methods and usage\n\n```python\nfrom collections import Counter\n\nwords = [\"api\", \"db\", \"api\", \"cache\"]\ncounts = Counter(words)\n\nprint(counts[\"api\"])              # 2\nprint(counts.most_common(2))       # [('api', 2), ('db', 1)]\ncounts.update([\"api\", \"queue\"])\ncounts.subtract([\"db\"])\nprint(+counts)                     # removes zero/negative counts\n```\n\nUse `Counter` for logs, tags, categories, inventory-like counting, and interview frequency problems.\n\n## defaultdict methods and usage\n\n```python\nfrom collections import defaultdict\n\norders_by_user = defaultdict(list)\nfor order in orders:\n    orders_by_user[order[\"user_id\"]].append(order)\n```\n\nCommon factories:\n\n```python\ndefaultdict(list)    # grouping\ndefaultdict(int)     # counting\ndefaultdict(set)     # unique grouped values\n```\n\nAvoid `defaultdict` when missing keys should be treated as bugs. In that case, a normal `dict` is clearer.\n\n## deque methods and usage\n\n```python\nfrom collections import deque\n\nq = deque(maxlen=3)\nq.append(\"a\")\nq.appendleft(\"start\")\nq.pop()\nq.popleft()\nq.extend([1, 2, 3])\nq.rotate(1)\n```\n\nUse `deque` for BFS, queues, sliding windows, recent-history buffers, and producer-consumer style code inside one process.\n\n```python\nwindow = deque(maxlen=5)\nfor value in stream:\n    window.append(value)\n    print(sum(window) / len(window))\n```\n",
  "python-dunder-methods": "\n## Dunder method protocol map\n\nDunder methods are Python's protocol hooks. You do not usually call them directly; Python calls them when syntax or built-ins are used.\n\n| Syntax / built-in | Dunder method | Purpose |\n|---|---|---|\n| `str(obj)` | `__str__` | user-friendly text |\n| `repr(obj)` | `__repr__` | developer/debug text |\n| `len(obj)` | `__len__` | size |\n| `for x in obj` | `__iter__`, `__next__` | iteration |\n| `obj[key]` | `__getitem__` | indexing/subscript access |\n| `obj[key] = value` | `__setitem__` | assignment by key/index |\n| `with obj:` | `__enter__`, `__exit__` | cleanup context |\n| `async with obj:` | `__aenter__`, `__aexit__` | async cleanup context |\n| `await obj` | `__await__` | custom awaitable |\n| `obj()` | `__call__` | callable object |\n| `a + b` | `__add__` | operator overloading |\n| `a == b` | `__eq__` | equality |\n| `a < b` | `__lt__` | ordering |\n| `bool(obj)` | `__bool__` | truthiness |\n\n## Production-style dunder example\n\n```python\nclass Money:\n    def __init__(self, amount: int, currency: str):\n        self.amount = amount\n        self.currency = currency\n\n    def __repr__(self):\n        return f\"Money(amount={self.amount!r}, currency={self.currency!r})\"\n\n    def __eq__(self, other):\n        if not isinstance(other, Money):\n            return NotImplemented\n        return (self.amount, self.currency) == (other.amount, other.currency)\n\n    def __add__(self, other):\n        if self.currency != other.currency:\n            raise ValueError(\"Currency mismatch\")\n        return Money(self.amount + other.amount, self.currency)\n```\n\nUse dunder methods when your object should behave like a Python object naturally. Do not overuse them for surprising behavior.\n",
  "source-fullstack-python-dunder-methods-the-interview-ready-map": "\n## Dunder method protocol map\n\nDunder methods are Python's protocol hooks. You do not usually call them directly; Python calls them when syntax or built-ins are used.\n\n| Syntax / built-in | Dunder method | Purpose |\n|---|---|---|\n| `str(obj)` | `__str__` | user-friendly text |\n| `repr(obj)` | `__repr__` | developer/debug text |\n| `len(obj)` | `__len__` | size |\n| `for x in obj` | `__iter__`, `__next__` | iteration |\n| `obj[key]` | `__getitem__` | indexing/subscript access |\n| `obj[key] = value` | `__setitem__` | assignment by key/index |\n| `with obj:` | `__enter__`, `__exit__` | cleanup context |\n| `async with obj:` | `__aenter__`, `__aexit__` | async cleanup context |\n| `await obj` | `__await__` | custom awaitable |\n| `obj()` | `__call__` | callable object |\n| `a + b` | `__add__` | operator overloading |\n| `a == b` | `__eq__` | equality |\n| `a < b` | `__lt__` | ordering |\n| `bool(obj)` | `__bool__` | truthiness |\n\n## Production-style dunder example\n\n```python\nclass Money:\n    def __init__(self, amount: int, currency: str):\n        self.amount = amount\n        self.currency = currency\n\n    def __repr__(self):\n        return f\"Money(amount={self.amount!r}, currency={self.currency!r})\"\n\n    def __eq__(self, other):\n        if not isinstance(other, Money):\n            return NotImplemented\n        return (self.amount, self.currency) == (other.amount, other.currency)\n\n    def __add__(self, other):\n        if self.currency != other.currency:\n            raise ValueError(\"Currency mismatch\")\n        return Money(self.amount + other.amount, self.currency)\n```\n\nUse dunder methods when your object should behave like a Python object naturally. Do not overuse them for surprising behavior.\n",
  "aws-s3": "\n## S3 console workflow and API map\n\n### Console workflow: create a production upload bucket\n\n1. Open **AWS Console \u2192 S3 \u2192 Buckets \u2192 Create bucket**.\n2. Choose the region close to the application/workload.\n3. Keep **Block Public Access** enabled unless the bucket is intentionally public.\n4. Enable **Bucket Versioning** for important user uploads or processed artifacts.\n5. Choose encryption: **SSE-S3** for normal cases, **SSE-KMS** for sensitive/customer-managed-key cases.\n6. Add lifecycle rules from **Management \u2192 Lifecycle rules** for temporary, failed, archive, and old processed files.\n7. Add prefix layout such as `incoming/`, `processed/`, `failed/`, `tmp/`.\n8. Test upload/download using the console first, then IAM-controlled application access.\n\n### High-value S3 APIs\n\n| API | Usage | Production note |\n|---|---|---|\n| `put_object` | Upload small object/body | use KMS, content type, metadata |\n| `get_object` | Read object stream | stream large files; avoid loading everything |\n| `head_object` | Check existence/metadata | useful before processing |\n| `list_objects_v2` | List by prefix | use paginator for large prefixes |\n| `delete_object` | Delete one object | versioning may create delete marker |\n| `copy_object` | Server-side copy | good for moving between prefixes |\n| `create_multipart_upload` | Large upload start | needed for big files |\n| `upload_part` | Upload one part | retry part failures |\n| `complete_multipart_upload` | Finalize multipart | cleanup aborted uploads |\n| `generate_presigned_url` | Temporary client access | keep short expiry and scoped operation |\n\n```python\nimport boto3\nfrom botocore.config import Config\n\ns3 = boto3.client(\"s3\", config=Config(retries={\"max_attempts\": 5, \"mode\": \"standard\"}))\n\nobj = s3.get_object(Bucket=\"my-bucket\", Key=\"incoming/file.csv\")\nfor chunk in iter(lambda: obj[\"Body\"].read(1024 * 1024), b\"\"):\n    process(chunk)\n```\n\n### S3 production workflow design\n\n```text\nclient/API\n  -> pre-signed upload URL\n  -> s3://bucket/incoming/job-id/file.csv\n  -> EventBridge or S3 notification\n  -> processor reads incoming/\n  -> processor writes processed/ or failed/\n  -> lifecycle deletes tmp/ after N days\n```\n",
  "aws-eventbridge": "\n## EventBridge console workflow and API map\n\n### Console workflow: route S3 object events to Step Functions or Lambda\n\n1. Open **S3 \u2192 bucket \u2192 Properties \u2192 Event notifications \u2192 Amazon EventBridge**.\n2. Turn on delivery to EventBridge for the bucket.\n3. Open **Amazon EventBridge \u2192 Rules \u2192 Create rule**.\n4. Select the **default event bus** for AWS service events.\n5. Choose **Event pattern**.\n6. Match `source = aws.s3`, `detail-type = Object Created`, bucket name, and optional object key prefix/suffix.\n7. Select target: Lambda, Step Functions, SQS, SNS, ECS task, Batch job, or another event bus.\n8. Configure retry policy and dead-letter queue where supported.\n9. Upload a matching test object and verify target execution/logs.\n\n### EventBridge APIs and concepts\n\n| API / concept | Use |\n|---|---|\n| `put_events` | publish custom application events |\n| event bus | receives events |\n| rule | filters matching events |\n| event pattern | JSON matching rule |\n| target | destination invoked by rule |\n| input transformer | reshape payload before target |\n| archive/replay | replay historical events for supported buses |\n| DLQ/retry policy | handle failed target delivery |\n\n```json\n{\n  \"source\": [\"aws.s3\"],\n  \"detail-type\": [\"Object Created\"],\n  \"detail\": {\n    \"bucket\": { \"name\": [\"my-input-bucket\"] },\n    \"object\": { \"key\": [{ \"prefix\": \"incoming/\" }] }\n  }\n}\n```\n\n### Custom application event\n\n```python\nimport boto3, json\n\nevents = boto3.client(\"events\")\n\nevents.put_events(Entries=[{\n    \"Source\": \"notes.app\",\n    \"DetailType\": \"NoteExportRequested\",\n    \"Detail\": json.dumps({\"userId\": \"u1\", \"topicId\": \"aws-s3\"}),\n    \"EventBusName\": \"default\",\n}])\n```\n",
  "aws-lambda": "\n## Lambda console workflow and runtime API map\n\n### Console workflow: create and wire a Lambda function\n\n1. Open **AWS Console \u2192 Lambda \u2192 Functions \u2192 Create function**.\n2. Choose **Author from scratch**.\n3. Select runtime, architecture, memory, timeout, and execution role.\n4. Under **Configuration \u2192 Permissions**, verify the execution role has only required access.\n5. Under **Configuration \u2192 General configuration**, tune memory and timeout.\n6. Add triggers from **Function overview \u2192 Add trigger**: API Gateway, EventBridge, S3, SQS, ALB, etc.\n7. Add environment variables from **Configuration \u2192 Environment variables**.\n8. Test with a real event shape from the trigger source.\n9. Check **Monitor \u2192 View CloudWatch logs**.\n\n### Lambda runtime methods and AWS APIs\n\n| API/concept | Use |\n|---|---|\n| handler function | entry point called by Lambda |\n| `event` | trigger payload |\n| `context` | request ID, remaining time, function metadata |\n| execution role | permissions used by code |\n| layers | shared libraries/dependencies |\n| versions/aliases | safe deployments |\n| reserved concurrency | cap function concurrency |\n| provisioned concurrency | reduce cold starts |\n| DLQ/destination | async failure handling |\n\n```python\nimport json\nimport logging\n\nlogger = logging.getLogger()\nlogger.setLevel(logging.INFO)\n\ndef lambda_handler(event, context):\n    logger.info(\"request started\", extra={\"aws_request_id\": context.aws_request_id})\n    return {\"statusCode\": 200, \"body\": json.dumps({\"ok\": True})}\n```\n\n### Lambda limits and architecture choices\n\nUse Lambda for short, event-driven, horizontally scalable work. Move to Step Functions, ECS/Fargate, AWS Batch, Glue, or EC2 when you need long-running jobs, heavy CPU/memory, complex orchestration, large local disk needs, or controlled runtime processes.\n",
  "aws-step-functions": "\n## Step Functions console workflow and state APIs\n\n### Console workflow: build a file-processing workflow\n\n1. Open **AWS Console \u2192 Step Functions \u2192 State machines \u2192 Create state machine**.\n2. Choose visual designer or write ASL JSON directly.\n3. Add states: `Pass`, `Task`, `Choice`, `Map`, `Parallel`, `Wait`, `Succeed`, `Fail`.\n4. For Lambda tasks, select the function and configure payload mapping.\n5. Add `Retry` for transient failures and `Catch` for controlled error paths.\n6. Choose execution role with permission to invoke target services.\n7. Start an execution with sample JSON input.\n8. Use the graph view to inspect each state input/output.\n9. Check CloudWatch Logs/X-Ray if enabled.\n\n### State/API map\n\n| State/API | Use |\n|---|---|\n| `Task` | call Lambda/AWS SDK/service integration |\n| `Choice` | branch by input data |\n| `Map` | process a list of items |\n| Distributed Map | massive parallel item processing |\n| `Parallel` | independent branches |\n| `Retry` | automatic retry with backoff |\n| `Catch` | route failure to cleanup/error state |\n| `start_execution` | start workflow from code |\n| `describe_execution` | check execution status |\n| `stop_execution` | terminate running workflow |\n\n```json\n{\n  \"StartAt\": \"ProcessFile\",\n  \"States\": {\n    \"ProcessFile\": {\n      \"Type\": \"Task\",\n      \"Resource\": \"arn:aws:states:::lambda:invoke\",\n      \"Parameters\": { \"FunctionName\": \"process-file\", \"Payload.$\": \"$\" },\n      \"Retry\": [{ \"ErrorEquals\": [\"States.ALL\"], \"IntervalSeconds\": 2, \"MaxAttempts\": 3, \"BackoffRate\": 2 }],\n      \"Catch\": [{ \"ErrorEquals\": [\"States.ALL\"], \"Next\": \"Failed\" }],\n      \"End\": true\n    },\n    \"Failed\": { \"Type\": \"Fail\" }\n  }\n}\n```\n",
  "aws-iam": "\n## IAM console workflow and policy API map\n\n### Console workflow: give a human controlled access\n\n1. Prefer **IAM Identity Center \u2192 Users/Groups \u2192 Permission sets \u2192 AWS account assignments**.\n2. Create or select a permission set.\n3. Scope access to the account/environment needed.\n4. For temporary project access, set a clear review/removal process.\n5. Validate access through the AWS access portal, not root credentials.\n\n### Console workflow: create a service role for Lambda/ECS/Step Functions\n\n1. Open **IAM \u2192 Roles \u2192 Create role**.\n2. Choose trusted entity: AWS service.\n3. Pick service: Lambda, ECS task, Step Functions, Glue, etc.\n4. Attach least-privilege policies.\n5. Name role by workload and environment, e.g. `prod-report-lambda-role`.\n6. Attach the role to the service.\n7. Test and refine with CloudTrail/Access Analyzer.\n\n### IAM API/action map\n\n| Action/concept | Use |\n|---|---|\n| `sts:AssumeRole` | assume role and receive temporary credentials |\n| trust policy | who can assume the role |\n| permissions policy | what the role can do |\n| resource policy | permissions attached to resource |\n| permission boundary | maximum identity permissions |\n| SCP | organization-level maximum guardrail |\n| `iam:PassRole` | allow one service/user to pass a role to another service |\n| condition keys | restrict by tag, source ARN, MFA, VPC endpoint, etc. |\n\n### Common IAM debugging path\n\n```text\nAccessDenied\n  -> identify principal ARN\n  -> identify action/resource in error\n  -> check identity policy\n  -> check resource policy\n  -> check permission boundary/SCP/session policy\n  -> check explicit deny\n  -> check region/account/resource ARN mismatch\n```\n",
  "aws-ecs-fargate": "\n## ECS Fargate console workflow and task API map\n\n### Console workflow: deploy a container on Fargate\n\n1. Push image to **ECR \u2192 Repositories**.\n2. Open **ECS \u2192 Clusters \u2192 Create cluster**.\n3. Choose **AWS Fargate** capacity.\n4. Create **Task definition**: container image, CPU, memory, ports, env vars, secrets, log configuration.\n5. Set **task execution role** for pulling image/logging and **task role** for application AWS permissions.\n6. Create **Service** from the task definition.\n7. Attach ALB target group if it is a web service.\n8. Configure desired count, auto scaling, health checks, and deployment strategy.\n9. Check logs in **CloudWatch Logs**.\n\n### ECS concepts and APIs\n\n| Concept/API | Use |\n|---|---|\n| cluster | logical grouping of services/tasks |\n| task definition | container blueprint |\n| task | running copy of task definition |\n| service | keeps desired number of tasks running |\n| task execution role | ECS agent pulls image/writes logs |\n| task role | app container calls AWS services |\n| `run_task` | one-off/background task |\n| `update_service` | deploy new desired state |\n| `describe_tasks` | inspect running task status |\n\nA task can contain multiple containers. One container uses one image, but one task can include app container + sidecar containers such as logging/proxy/agent containers.\n",
  "aws-eks-kubernetes": "\n## EKS Kubernetes workflow and kubectl API map\n\n### Console workflow: create an EKS-backed Kubernetes environment\n\n1. Open **EKS \u2192 Clusters \u2192 Create cluster**.\n2. Choose Kubernetes version, cluster IAM role, VPC, subnets, security groups, and endpoint access.\n3. Add compute: managed node group, Fargate profile, or self-managed nodes.\n4. Configure `kubectl` access through kubeconfig.\n5. Install/verify add-ons: VPC CNI, CoreDNS, kube-proxy, EBS CSI where needed.\n6. Deploy workloads with Kubernetes manifests or Helm.\n7. Expose services through LoadBalancer/Ingress Controller.\n8. Use CloudWatch/Prometheus/logging stack for observability.\n\n### Kubernetes object map\n\n| Object/API | Use |\n|---|---|\n| Pod | smallest deployable unit |\n| Deployment | manages replicated pods and rollouts |\n| Service | stable networking over pods |\n| Ingress | HTTP routing into cluster |\n| ConfigMap | non-secret config |\n| Secret | sensitive config |\n| Job/CronJob | run-to-completion/background scheduled work |\n| HPA | horizontal autoscaling |\n| Namespace | logical isolation |\n\n```bash\nkubectl get pods -n app\nkubectl describe pod <pod-name> -n app\nkubectl logs deployment/api -n app\nkubectl rollout status deployment/api -n app\n```\n",
  "aws-glue": "\n## Glue console workflow and ETL API map\n\n### Console workflow: create a Glue ETL job\n\n1. Open **AWS Glue \u2192 ETL jobs \u2192 Create job**.\n2. Choose Spark/Python shell depending on workload.\n3. Set source and target locations, usually S3 paths or Data Catalog tables.\n4. Choose IAM role with S3/Data Catalog/KMS permissions.\n5. Configure workers, retries, timeout, job parameters, and bookmarks.\n6. Add script or use visual job editor.\n7. Run job and inspect **Runs**, logs, metrics, and output prefix.\n\n### Glue APIs/concepts\n\n| API/concept | Use |\n|---|---|\n| Glue Data Catalog | metadata tables/databases |\n| crawler | infer schema from data source |\n| job bookmark | avoid reprocessing already-seen data |\n| `getResolvedOptions` | read job args |\n| DynamicFrame | Glue abstraction over semi-structured data |\n| Spark DataFrame | powerful transformations |\n| trigger/workflow | schedule/orchestrate Glue jobs |\n\nGlue is a better fit than Lambda when files are large, transformations are heavy, execution time is long, or Spark-style distributed processing is needed.\n",
  "aws-cloudwatch": "\n## CloudWatch console workflow and observability API map\n\n### Console workflow: debug a failing workload\n\n1. Open **CloudWatch \u2192 Log groups**.\n2. Choose the service log group, such as `/aws/lambda/function-name` or ECS task logs.\n3. Open latest log stream or use **Logs Insights**.\n4. Query by request ID, correlation ID, error text, or timestamp.\n5. Check **Metrics** for invocations, errors, duration, throttles, queue depth, target 5xx, etc.\n6. Create **Alarms** for user-impacting failures.\n7. Connect alarms to SNS/Slack/PagerDuty-style notifications.\n\n### Logs Insights examples\n\n```sql\nfields @timestamp, @message\n| filter @message like /ERROR|Exception|AccessDenied/\n| sort @timestamp desc\n| limit 50\n```\n\n```sql\nfields @timestamp, requestId, latencyMs, statusCode\n| stats avg(latencyMs), pct(latencyMs, 95), count(*) by statusCode\n```\n\n### CloudWatch APIs/concepts\n\n| Concept/API | Use |\n|---|---|\n| log group/log stream | structured location of logs |\n| metric | numeric time series |\n| alarm | threshold/anomaly alert |\n| dashboard | visual operational view |\n| `put_metric_data` | custom metrics |\n| Logs Insights | query logs |\n| embedded metric format | metrics from structured logs |\n",
  "aws-terraform": "\n## Terraform on AWS workflow and command map\n\n### Console + Terraform workflow\n\n1. In AWS, create or choose an IAM role/user for Terraform with scoped permissions.\n2. Store state remotely using **S3 backend** and use **DynamoDB lock table** where applicable.\n3. Keep provider config, variables, modules, and environment values separated.\n4. Run `terraform fmt`, `terraform validate`, `terraform plan`.\n5. Review the plan before `terraform apply`.\n6. Use separate workspaces/accounts/directories for dev, UAT, and prod.\n\n### Terraform command map\n\n| Command | Use |\n|---|---|\n| `terraform init` | initialize providers/backend/modules |\n| `terraform fmt` | format files |\n| `terraform validate` | static config validation |\n| `terraform plan` | preview changes |\n| `terraform apply` | create/update infrastructure |\n| `terraform destroy` | delete managed infrastructure |\n| `terraform state list` | inspect state resources |\n| `terraform import` | bring existing resource under state |\n| `terraform taint` / `-replace` | force replacement |\n\n```hcl\nresource \"aws_s3_bucket\" \"uploads\" {\n  bucket = \"my-prod-uploads\"\n}\n\nresource \"aws_s3_bucket_versioning\" \"uploads\" {\n  bucket = aws_s3_bucket.uploads.id\n  versioning_configuration { status = \"Enabled\" }\n}\n```\n"
};

function safeTitle(note) {
  return String(note?.title || 'Topic').replace(/[`*_#[\]]/g, '').trim() || 'Topic';
}

function firstHeading(markdown = '') {
  const match = String(markdown).match(/^##\s+(.+)$/m);
  return match?.[1]?.trim() || '';
}

function alreadyHas(content = '', enhancement = '') {
  const heading = firstHeading(enhancement).toLowerCase();
  return heading ? String(content).toLowerCase().includes(`## ${heading}`) : false;
}

export function cleanGeneratedNoteLanguage(note, content = '') {
  const title = safeTitle(note);
  return String(content)
    .replace(/^##\s+Additional Concepts Added\s*$/gm, `## Advanced ${title} concepts`)
    .replace(/^##\s+Additional deep implementation notes\s*$/gm, `## ${title} implementation notes`)
    .replace(/^##\s+Source expansion:\s*(.+?)\s*$/gm, '## $1')
    .replace(/> Source note truncated inside merged topic to protect browser performance\. The complete extracted note remains available as its own source\/reference topic\./g, '> Long source material is summarized here for browser performance; the full source remains available as its own reference topic.')
    .replace(/This expansion is added to avoid treating .*? as a small definition-only topic\.[^\n]*\n/gi, '')
    .replace(/^##\s+Important methods and APIs to know\s*$/gmi, `## ${title} methods and APIs`)
    .replace(/ — learn the syntax, lifecycle, failure case, and where it appears in a real project\./g, '');
}

function awsGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} practical workflow map

### Console path

Use this structure when you need to set up or debug ${title} from the AWS Console:

1. Open the service page for **${title}**.
2. Locate the resource: function, bucket, queue, state machine, cluster, database, rule, policy, or log group.
3. Check **configuration first**: region, account, resource name/ARN, IAM role, network/VPC, encryption, timeout, retry/DLQ, and logging.
4. Trigger a small test event/request.
5. Verify output in the target service and logs in **CloudWatch**.
6. Check **CloudTrail** when the issue looks permission-related.
7. Add alarms/metrics once the happy path works.

### ${title} API and method checklist

| Area | What to know |
|---|---|
| Create/update | How the resource is created, configured, deployed, versioned, and rolled back |
| Runtime call | Which API/action is called by code or another AWS service |
| Permissions | Which execution role, resource policy, trust policy, or service-linked role is involved |
| Retry behavior | Who retries: service integration, Lambda async retry, SQS redelivery, Step Functions retry, or client retry |
| Failure output | Where failed events go: DLQ, Catch path, failed prefix, CloudWatch log, alarm, or error response |
| Idempotency | Which key prevents duplicate processing: object key/version, message ID, request ID, job ID, or database unique key |

### Production debugging flow

\`\`\`text
symptom
  -> confirm region/account/resource
  -> inspect CloudWatch logs/metrics
  -> inspect IAM AccessDenied or service error
  -> replay with minimal input
  -> verify retry/DLQ/Catch behavior
  -> add test/alarm so it is caught next time
\`\`\`
`;
}

function pythonGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} methods and usage map

### What to learn for this Python topic

For ${title}, do not stop at the definition. Learn the object model, important functions/classes, runtime behavior, common exceptions, and where the feature appears in real backend/AWS code.

| Layer | Questions to answer |
|---|---|
| Syntax | What is the exact syntax and smallest working example? |
| Runtime | What object is created and when does the code actually run? |
| APIs | Which functions/classes/methods are used most often? |
| Errors | What exceptions or edge cases are common? |
| Production use | How does it appear in APIs, workers, AWS Lambda, ETL, tests, or scripts? |

### Real project usage shape

\`\`\`python
import logging

logger = logging.getLogger(__name__)


def run_feature(payload, dependency):
    logger.info("feature.started", extra={"payload_id": payload.get("id")})
    try:
        result = dependency.execute(payload)
        logger.info("feature.completed", extra={"result_id": getattr(result, "id", None)})
        return result
    except Exception:
        logger.exception("feature.failed")
        raise
\`\`\`
`;
}

function apiGeneric(note) {
  const title = safeTitle(note);
  const group = note.group || note.domain || 'API';
  return `

## ${title} request lifecycle and methods

### Request workflow

\`\`\`text
client
  -> route match
  -> middleware/dependencies
  -> auth/authz
  -> validation/parsing
  -> service layer
  -> database/external API
  -> response serialization
  -> logs/metrics
\`\`\`

### ${group} method checklist

| Area | Methods/details to cover |
|---|---|
| Routing | path params, query params, body/form/file parsing |
| Validation | schema rules, default values, custom validators |
| Auth | token/session extraction, current user dependency, permission checks |
| Errors | 400/401/403/404/409/422/500 handling |
| Database | session lifecycle, transactions, rollback, pagination |
| Production | CORS, rate limits, request IDs, logging, background jobs |

### Endpoint structure example

\`\`\`python
def endpoint_handler(input_data, current_user, service):
    # 1. request already parsed/validated
    # 2. authorization is explicit
    # 3. business logic lives in service layer
    # 4. route returns a stable response shape
    result = service.execute(input_data, actor=current_user)
    return {"data": result, "error": None}
\`\`\`
`;
}

function reactGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} implementation workflow

### React lifecycle questions

| Question | Why it matters |
|---|---|
| What state changes? | State changes trigger render work |
| Which components rerender? | Performance depends on render boundaries |
| Which effects run? | Effects can create duplicate API calls or stale closures |
| What cleanup is required? | Prevent leaked timers, listeners, requests, and subscriptions |
| What should stay local? | Not all state belongs in Redux/global stores |

### Production component pattern

\`\`\`jsx
function Feature({ loadData }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));

    loadData({ signal: controller.signal })
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', data: null, error });
      });

    return () => controller.abort();
  }, [loadData]);

  return null;
}
\`\`\`
`;
}

function reduxGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} Redux/RTK workflow

### Store lifecycle

\`\`\`text
UI event
  -> dispatch action/thunk/query
  -> middleware handles async/cache
  -> reducer updates state immutably
  -> selectors read derived data
  -> subscribed components rerender
\`\`\`

### RTK method map

| API | Use |
|---|---|
| \`configureStore\` | create store with good defaults |
| \`createSlice\` | reducers + actions together |
| \`createAsyncThunk\` | request lifecycle: pending/fulfilled/rejected |
| \`createEntityAdapter\` | normalized collections |
| \`createSelector\` | memoized derived data |
| \`createApi\` | server-state cache, fetching, invalidation |
| \`providesTags\` / \`invalidatesTags\` | cache refresh rules |

Use Redux for shared client state and RTK Query for server cache. Do not duplicate API data manually unless you need a custom read model.
`;
}

function databaseGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} database workflow and commands

### What to cover for this database topic

| Area | Questions |
|---|---|
| Schema | tables/columns/relationships/constraints |
| Query | SQL shape, filters, joins, sorting, pagination |
| Performance | indexes, query plan, connection pooling, caching |
| Safety | transactions, locks, isolation, migrations, backups |
| Operations | monitoring, slow query logs, vacuum/analyze, replication |

### PostgreSQL debugging commands

\`\`\`sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE user_id = 42 ORDER BY created_at DESC LIMIT 20;

SELECT * FROM pg_stat_activity;
SELECT * FROM pg_indexes WHERE tablename = 'orders';
\`\`\`
`;
}

function devopsGeneric(note) {
  const title = safeTitle(note);
  return `

## ${title} operational workflow

### Deployment/debug checklist

| Stage | Check |
|---|---|
| Build | reproducible build, locked dependencies, tested artifact |
| Config | env vars/secrets separated from code |
| Runtime | CPU/memory/ports/health checks/logging |
| Release | rollout strategy, rollback path, version/tag |
| Observability | logs, metrics, alerts, traces where needed |
| Security | least privilege, image scanning, network boundaries |

### Failure-first mental model

\`\`\`text
deploy fails
  -> check build artifact
  -> check runtime config/secrets
  -> check logs and health check
  -> check networking/IAM
  -> rollback or patch forward
\`\`\`
`;
}

export function appendTopicDepth(note, content = '') {
  const group = note.group || note.domain || '';
  const title = safeTitle(note);
  const exact = exactEnhancements[note.id];

  if (exact && !alreadyHas(content, exact)) {
    return `${content.trim()}\n\n${exact.trim()}\n`;
  }

  let enhancement = '';
  if (group === 'AWS') enhancement = awsGeneric(note);
  else if (group === 'Python') enhancement = pythonGeneric(note);
  else if (group === 'Flask' || group === 'FastAPI' || group === 'Backend Concepts') enhancement = apiGeneric(note);
  else if (group === 'React' || group === 'Frontend Concepts') enhancement = reactGeneric(note);
  else if (group === 'Redux') enhancement = reduxGeneric(note);
  else if (group === 'Databases') enhancement = databaseGeneric(note);
  else if (group === 'DevOps') enhancement = devopsGeneric(note);

  if (!enhancement || alreadyHas(content, enhancement)) return content;
  return `${content.trim()}\n\n${enhancement.trim()}\n`;
}
