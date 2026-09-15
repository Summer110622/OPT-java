(() => {
  'use strict';

  const text = {
    ja: {sample:'サンプルコード',before:'Before',after:'After',measure:'計測例',copy:'コピー',copied:'コピー済み',note:'このコードは考え方を示す最小例です。実際の効果は JDK・入力・負荷・ハードウェアで変わるため、必ず自分の workload で測定してください。'},
    en: {sample:'Sample code',before:'Before',after:'After',measure:'Measurement example',copy:'Copy',copied:'Copied',note:'These are minimal examples that demonstrate the idea. Results vary by JDK, input, load and hardware; always measure your own workload.'}
  };

  const specific = {
    'jit-warmup': {
      before:`// Bad benchmark: mixes startup and steady state\nlong t0 = System.nanoTime();\nfor (int i = 0; i < 1_000; i++) {\n    service.handle(input);\n}\nSystem.out.println(System.nanoTime() - t0);`,
      after:`// Separate warmup from measurement\nfor (int i = 0; i < 20_000; i++) {\n    service.handle(input);\n}\n\nlong t0 = System.nanoTime();\nfor (int i = 0; i < 100_000; i++) {\n    service.handle(input);\n}\nlong elapsed = System.nanoTime() - t0;`,
      measure:`java -XX:StartFlightRecording=filename=app.jfr,duration=60s -jar app.jar\n# Inspect Compilation / Deoptimization events in JDK Mission Control`
    },
    'inlining': {
      before:`interface PriceRule {\n    int apply(int value);\n}\n\nint total(List<PriceRule> rules, int value) {\n    for (PriceRule rule : rules) {\n        value = rule.apply(value); // polymorphic hot call site\n    }\n    return value;\n}`,
      after:`final class FixedRule {\n    static int apply(int value) {\n        return value * 95 / 100;\n    }\n}\n\nint total(int value) {\n    return FixedRule.apply(value); // easier for JIT to inline\n}`,
      measure:`java -XX:+UnlockDiagnosticVMOptions -XX:+PrintCompilation -jar app.jar\n# Prefer JFR/benchmark evidence before restructuring APIs for inlining.`
    },
    'escape-analysis': {
      before:`Point p = new Point(x, y);\ncache.put(id, p); // escapes to shared state\nreturn p.x() + p.y();`,
      after:`Point p = new Point(x, y);\nreturn p.x() + p.y(); // local-only object may be scalar replaced`,
      measure:`async-profiler -e alloc -d 30 -f alloc.html <pid>\n# Compare allocation samples before/after.`
    },
    'class-loading': {
      before:`Class<?> type = Class.forName(className);\nObject value = type.getDeclaredConstructor().newInstance();`,
      after:`// Cache resolved constructors/factories when the set is stable\nprivate final Map<String, Supplier<?>> factories = Map.of(\n    "foo", Foo::new,\n    "bar", Bar::new\n);\n\nObject value = factories.get(className).get();`,
      measure:`jcmd <pid> VM.classloader_stats\njcmd <pid> VM.native_memory summary`
    },
    'collector-selection': {
      before:`// Do not choose a collector from folklore alone.\n// -XX:+UseG1GC`,
      after:`// Example experiment matrix:\n// G1:  -XX:+UseG1GC\n// ZGC: -XX:+UseZGC\n// Keep heap and workload equivalent, then compare p99/CPU/RSS.`,
      measure:`java -Xms4g -Xmx4g -Xlog:gc*:file=gc.log -jar app.jar\n# Run the same load against each collector.`
    },
    'heap-sizing': {
      before:`// Tiny heap can force excessive GC\n// -Xms256m -Xmx256m`,
      after:`// Size from measured live set + headroom, not guesswork\n// Example experiment only:\n// -Xms2g -Xmx2g`,
      measure:`java -Xlog:gc+heap=debug -Xms2g -Xmx2g -jar app.jar\njcmd <pid> GC.heap_info`
    },
    'humongous-objects': {
      before:`byte[] payload = new byte[32 * 1024 * 1024];\nprocess(payload);`,
      after:`byte[] chunk = new byte[256 * 1024];\nwhile (source.read(chunk) >= 0) {\n    processChunk(chunk);\n}`,
      measure:`java -Xlog:gc*=info -jar app.jar\n# Inspect large allocations / G1 humongous regions.`
    },
    'allocation-rate': {
      before:`for (Order order : orders) {\n    String line = order.id() + ":" + order.total();\n    sink.accept(line);\n}`,
      after:`StringBuilder sb = new StringBuilder(128);\nfor (Order order : orders) {\n    sb.setLength(0);\n    sb.append(order.id()).append(':').append(order.total());\n    sink.accept(sb.toString());\n}`,
      measure:`async-profiler -e alloc -d 30 -f alloc.html <pid>\n# Compare allocated bytes/op as well as CPU.`
    },
    'autoboxing': {
      before:`long sum = values.stream()\n    .map(v -> v * 2)   // Stream<Integer>\n    .reduce(0, Integer::sum);`,
      after:`long sum = values.stream()\n    .mapToInt(Integer::intValue)\n    .map(v -> v * 2)\n    .asLongStream()\n    .sum();`,
      measure:`@Benchmark\npublic long boxed() { /* ... */ }\n\n@Benchmark\npublic long primitive() { /* ... */ }\n# Add -prof gc to JMH to compare allocation.`
    },
    'string-allocation': {
      before:`String result = "";\nfor (String part : parts) {\n    result += part;\n}`,
      after:`StringBuilder sb = new StringBuilder();\nfor (String part : parts) {\n    sb.append(part);\n}\nString result = sb.toString();`,
      measure:`async-profiler -e alloc -d 20 -f strings.html <pid>\n# Confirm String/StringBuilder allocation in the real path.`
    },
    'threadlocal-retention': {
      before:`static final ThreadLocal<byte[]> BUF =\n    ThreadLocal.withInitial(() -> new byte[8 * 1024 * 1024]);\n\nvoid handle() {\n    use(BUF.get());\n}`,
      after:`void handle() {\n    byte[] buf = pool.borrow(64 * 1024);\n    try {\n        use(buf);\n    } finally {\n        pool.release(buf);\n    }\n}`,
      measure:`jcmd <pid> GC.heap_dump heap.hprof\n# Inspect retained paths from worker threads / ThreadLocalMap.`
    },
    'algorithmic-complexity': {
      before:`for (User a : users) {\n    for (User b : users) {\n        if (a.managerId().equals(b.id())) {\n            attach(a, b);\n        }\n    }\n}`,
      after:`Map<Long, User> byId = users.stream()\n    .collect(Collectors.toMap(User::id, Function.identity()));\n\nfor (User user : users) {\n    attach(user, byId.get(user.managerId()));\n}`,
      measure:`# Benchmark n = 1k, 2k, 4k, 8k...\n# Plot elapsed time against input size instead of one data point.`
    },
    'loops-vs-streams': {
      before:`int sum = values.stream()\n    .filter(v -> v > 0)\n    .mapToInt(Integer::intValue)\n    .sum();`,
      after:`int sum = 0;\nfor (int v : values) {\n    if (v > 0) sum += v;\n}\n// Use whichever is clearer unless profiling proves this path matters.`,
      measure:`@Benchmark\npublic int streamVersion() { /* ... */ }\n\n@Benchmark\npublic int loopVersion() { /* ... */ }`
    },
    'regex': {
      before:`boolean ok(String s) {\n    return Pattern.compile("[A-Z]+-[0-9]+")\n        .matcher(s)\n        .matches();\n}`,
      after:`private static final Pattern ID =\n    Pattern.compile("[A-Z]+-[0-9]+");\n\nboolean ok(String s) {\n    return ID.matcher(s).matches();\n}`,
      measure:`async-profiler -e cpu -d 30 -f cpu.html <pid>\n# Look for Pattern.compile / Matcher hotspots.`
    },
    'exceptions-hotpath': {
      before:`int parse(String s) {\n    try {\n        return Integer.parseInt(s);\n    } catch (NumberFormatException e) {\n        return 0;\n    }\n}`,
      after:`int parseKnownNumeric(String s) {\n    if (!looksNumeric(s)) return 0;\n    return Integer.parseInt(s);\n}\n// Validate only if invalid input is actually frequent.`,
      measure:`# Measure exceptions/s and allocation rate.\n# Do not replace clear exception handling without evidence.`
    },
    'thread-pool-sizing': {
      before:`ExecutorService pool = Executors.newFixedThreadPool(200);`,
      after:`int cpu = Runtime.getRuntime().availableProcessors();\nExecutorService cpuPool = Executors.newFixedThreadPool(cpu);\n// Blocking workloads require a different model; measure queueing.`,
      measure:`# Sweep pool size: 1, 2, 4, 8, ...\n# Record throughput, p99, queue depth and CPU utilization.`
    },
    'virtual-threads': {
      before:`ExecutorService pool = Executors.newFixedThreadPool(200);\nFuture<Result> f = pool.submit(() -> blockingCall());`,
      after:`try (ExecutorService pool =\n         Executors.newVirtualThreadPerTaskExecutor()) {\n    Future<Result> f = pool.submit(() -> blockingCall());\n}`,
      measure:`java -Djdk.tracePinnedThreads=full -jar app.jar\n# Also inspect JFR virtual-thread pinning events where available.`
    },
    'lock-contention': {
      before:`synchronized void record(String key) {\n    counts.merge(key, 1L, Long::sum);\n}`,
      after:`private final ConcurrentHashMap<String, LongAdder> counts =\n    new ConcurrentHashMap<>();\n\nvoid record(String key) {\n    counts.computeIfAbsent(key, k -> new LongAdder()).increment();\n}`,
      measure:`jfr start name=locks settings=profile filename=locks.jfr duration=60s\n# Inspect Java Monitor Blocked / park events.`
    },
    'atomics-longadder': {
      before:`private final AtomicLong requests = new AtomicLong();\n\nvoid hit() {\n    requests.incrementAndGet();\n}`,
      after:`private final LongAdder requests = new LongAdder();\n\nvoid hit() {\n    requests.increment();\n}`,
      measure:`# Compare under realistic contention.\n# LongAdder trades exact instantaneous value semantics for scalable updates.`
    },
    'backpressure': {
      before:`BlockingQueue<Job> q = new LinkedBlockingQueue<>(); // unbounded\nq.put(job);`,
      after:`BlockingQueue<Job> q = new ArrayBlockingQueue<>(10_000);\nif (!q.offer(job)) {\n    rejectOrShed(job);\n}`,
      measure:`# Record queue depth, rejected work, p99 and heap.\n# Test overload rather than only nominal traffic.`
    },
    'buffered-io': {
      before:`try (InputStream in = Files.newInputStream(path)) {\n    int b;\n    while ((b = in.read()) != -1) {\n        consume(b);\n    }\n}`,
      after:`try (InputStream in = new BufferedInputStream(\n         Files.newInputStream(path), 64 * 1024)) {\n    byte[] buf = new byte[64 * 1024];\n    int n;\n    while ((n = in.read(buf)) >= 0) {\n        consume(buf, n);\n    }\n}`,
      measure:`# Compare bytes/s, syscalls/s, CPU and p99.\n# Repeat with cold and warm page cache separately.`
    },
    'serialization': {
      before:`String json = objectMapper.writeValueAsString(event);\nsend(json.getBytes(StandardCharsets.UTF_8));`,
      after:`// Avoid an intermediate String when the API supports bytes directly\nbyte[] payload = objectMapper.writeValueAsBytes(event);\nsend(payload);`,
      measure:`# Measure bytes/message, allocations/message and CPU/message.`
    },
    'arraylist-capacity': {
      before:`List<Row> rows = new ArrayList<>();\nfor (Input x : input) {\n    rows.add(convert(x));\n}`,
      after:`List<Row> rows = new ArrayList<>(input.size());\nfor (Input x : input) {\n    rows.add(convert(x));\n}`,
      measure:`# Useful only when final size is reliably known.\n# Compare allocation and retained capacity.`
    },
    'hashmap-capacity': {
      before:`Map<Long, User> map = new HashMap<>();\nfor (User u : users) map.put(u.id(), u);`,
      after:`int expected = users.size();\nint capacity = (int) Math.ceil(expected / 0.75d);\nMap<Long, User> map = new HashMap<>(capacity);\nfor (User u : users) map.put(u.id(), u);`,
      measure:`# Compare build time, allocations and retained heap.\n# Avoid extreme oversizing.`
    },
    'arraydeque': {
      before:`Queue<Job> q = new LinkedList<>();\nq.add(job);\nJob next = q.remove();`,
      after:`Queue<Job> q = new ArrayDeque<>();\nq.add(job);\nJob next = q.remove();`,
      measure:`@Benchmark\npublic Job dequeue() { /* compare realistic queue sizes */ }`
    },
    'jdbc-pool': {
      before:`Connection c = DriverManager.getConnection(url, user, pass);\ntry {\n    runQuery(c);\n} finally {\n    c.close();\n}`,
      after:`try (Connection c = dataSource.getConnection()) {\n    runQuery(c);\n}\n// Use a bounded pool sized from DB capacity and measured wait time.`,
      measure:`# Track pool active/idle/wait time and DB sessions.\n# More connections can reduce throughput after DB saturation.`
    },
    'prepared-statements': {
      before:`String sql = "select * from users where id = " + id;\ntry (Statement s = c.createStatement()) {\n    return s.executeQuery(sql);\n}`,
      after:`try (PreparedStatement ps = c.prepareStatement(\n        "select * from users where id = ?")) {\n    ps.setLong(1, id);\n    return ps.executeQuery();\n}`,
      measure:`# Measure query latency and DB parse/plan CPU.\n# Prepared statements also avoid SQL injection.`
    },
    'batch-dml': {
      before:`for (Row row : rows) {\n    try (PreparedStatement ps = c.prepareStatement(SQL)) {\n        bind(ps, row);\n        ps.executeUpdate();\n    }\n}`,
      after:`try (PreparedStatement ps = c.prepareStatement(SQL)) {\n    for (Row row : rows) {\n        bind(ps, row);\n        ps.addBatch();\n    }\n    ps.executeBatch();\n}`,
      measure:`# Compare rows/round-trip, DB CPU, transaction time and p99.`
    },
    'nplus1': {
      before:`for (Order order : orders) {\n    List<Item> items = itemDao.findByOrderId(order.id());\n    render(order, items);\n}`,
      after:`Map<Long, List<Item>> items =\n    itemDao.findByOrderIds(orderIds).stream()\n        .collect(Collectors.groupingBy(Item::orderId));\n\nfor (Order order : orders) {\n    render(order, items.getOrDefault(order.id(), List.of()));\n}`,
      measure:`# Primary metric: queries/request.\n# Also compare result size and DB plan for the batched query.`
    },
    'http-connection-reuse': {
      before:`HttpClient client = HttpClient.newHttpClient();\n// Creating/configuring a new client per request defeats pooling in many designs.`,
      after:`final class Clients {\n    static final HttpClient HTTP = HttpClient.newBuilder()\n        .connectTimeout(Duration.ofSeconds(2))\n        .build();\n}\n\nHttpResponse<String> r = Clients.HTTP.send(request,\n    HttpResponse.BodyHandlers.ofString());`,
      measure:`# Track new connections/s, TLS handshakes, requests/connection and p99.`
    },
    'request-batching': {
      before:`for (Id id : ids) {\n    client.fetch(id); // one remote round trip per item\n}`,
      after:`for (List<Id> batch : partition(ids, 100)) {\n    client.fetchBatch(batch);\n}`,
      measure:`# Sweep batch size. Record requests/s, bytes/request, p99 and retry cost.`
    },
    'timeouts-retries': {
      before:`while (true) {\n    try { return remote.call(); }\n    catch (IOException ignored) { }\n}`,
      after:`for (int attempt = 0; attempt < 3; attempt++) {\n    try {\n        return remote.call(Duration.ofMillis(500));\n    } catch (IOException e) {\n        Thread.sleep(backoffWithJitter(attempt));\n    }\n}\nthrow new IOException("retry budget exhausted");`,
      measure:`# Record attempts/request, timeout rate, retry-success rate and downstream load.`
    },
    'jfr': {
      before:`// No production evidence\nlog.info("API feels slow");`,
      after:`// Start a bounded recording from the JVM\nvar r = new jdk.jfr.Recording();\nr.setName("slow-request");\nr.setDuration(Duration.ofSeconds(60));\nr.start();\n// ... later: r.dump(Path.of("slow.jfr"));`,
      measure:`jcmd <pid> JFR.start name=profile settings=profile duration=60s filename=profile.jfr`
    },
    'jmh': {
      before:`long t0 = System.nanoTime();\nfor (int i = 0; i < 1_000_000; i++) work();\nSystem.out.println(System.nanoTime() - t0);`,
      after:`@State(Scope.Thread)\npublic class Bench {\n    @Benchmark\n    public Result workBench() {\n        return work();\n    }\n}`,
      measure:`java -jar target/benchmarks.jar -wi 5 -i 10 -f 3\n# Add -prof gc for allocation and GC information.`
    },
    'heap-dump': {
      before:`// Guessing which cache leaks memory\ncache.clear();`,
      after:`// Capture evidence first\n// jcmd <pid> GC.heap_dump heap.hprof\n// Then inspect dominators / retained paths before changing ownership.`,
      measure:`jcmd <pid> GC.heap_dump heap.hprof\n# Analyze with Eclipse MAT or another heap analyzer.`
    }
  };

  function categoryFallback(topic, category) {
    const name = topic.en.replace(/[^A-Za-z0-9]+/g, '');
    const snippets = {
      JVM: {
        before:`// ${topic.en}: change JVM behavior without evidence\nrunApplication();`,
        after:`// ${topic.en}: isolate one JVM-related change\nrecordBaseline();\nrunApplication();\nrecordJfrEvents();`,
        measure:`jcmd <pid> JFR.start settings=profile duration=60s filename=profile.jfr`
      },
      GC: {
        before:`// ${topic.en}: tune several GC flags at once`,
        after:`// Change one variable at a time and keep workload constant\n// java -Xlog:gc*=info ... -jar app.jar`,
        measure:`java -Xlog:gc*:file=gc.log -jar app.jar`
      },
      Memory: {
        before:`List<Object> retained = new ArrayList<>();\nretained.add(expensiveObject());`,
        after:`// Keep ownership/lifetime explicit\ntry (Resource r = acquire()) {\n    use(r);\n}`,
        measure:`async-profiler -e alloc -d 30 -f alloc.html <pid>\njcmd <pid> GC.heap_dump heap.hprof`
      },
      CPU: {
        before:`Result result = expensiveTransform(input);\nconsume(result);`,
        after:`if (isNeeded(input)) {\n    Result result = expensiveTransform(input);\n    consume(result);\n}`,
        measure:`async-profiler -e cpu -d 30 -f cpu.html <pid>`
      },
      Concurrency: {
        before:`synchronized (shared) {\n    update(shared);\n}`,
        after:`// Reduce shared mutation or partition state\nState shard = shards.get(shardId);\nupdate(shard);`,
        measure:`jcmd <pid> Thread.print\n# Correlate blocked/park time with throughput and p99.`
      },
      'I/O': {
        before:`for (byte b : data) {\n    out.write(b);\n}`,
        after:`out.write(data);\nout.flush(); // only where the durability/visibility boundary requires it`,
        measure:`# Compare bytes/s, syscalls/s, CPU and p99 under the same payload.`
      },
      Collections: {
        before:`List<Item> items = new LinkedList<>();\nfor (Item x : source) items.add(x);`,
        after:`List<Item> items = new ArrayList<>(source.size());\nitems.addAll(source);`,
        measure:`# Benchmark realistic collection sizes and operation mixes.`
      },
      Database: {
        before:`for (Id id : ids) {\n    dao.fetch(id);\n}`,
        after:`dao.fetchBatch(ids);`,
        measure:`# Measure queries/request, DB execution time, pool wait and p99.`
      },
      Network: {
        before:`for (Request r : requests) {\n    openConnectionAndSend(r);\n}`,
        after:`Connection c = pool.borrow();\ntry {\n    for (Request r : requests) c.send(r);\n} finally {\n    pool.release(c);\n}`,
        measure:`# Measure connects/s, handshakes, bytes/request, retries and p99.`
      },
      Tooling: {
        before:`// Optimize from intuition\nchangeCode();`,
        after:`captureBaseline();\nprofile();\nchangeOneThing();\nmeasureAgain();`,
        measure:`jcmd <pid> JFR.start settings=profile duration=60s filename=profile.jfr`
      }
    };
    return snippets[category];
  }

  function sampleFor(entry) {
    const index = entries.indexOf(entry);
    const topic = topics[Math.floor(index / angles.length)];
    return specific[topic.id] || categoryFallback(topic, entry.category);
  }

  const css = document.createElement('style');
  css.textContent = `
    .sample-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin:.7rem 0}
    .sample-panel{min-width:0;border:1px solid #a2a9b1;background:#f8f9fa}
    .sample-panel h4{margin:0;padding:.35rem .55rem;border-bottom:1px solid #a2a9b1;background:#eaecf0;font-size:.86rem}
    .sample-code{position:relative;background:#f8f9fa}
    .sample-code pre{margin:0;padding:.8rem;overflow:auto;font-size:.8rem;line-height:1.45;background:#f8f9fa;color:#202122}
    .sample-copy{position:absolute;top:.35rem;right:.35rem;font:inherit;font-size:.72rem;color:#0645ad;border:1px solid #a2a9b1;background:#fff;padding:.15rem .38rem;cursor:pointer}
    .sample-measure{margin-top:.8rem;border:1px solid #a2a9b1;background:#f8f9fa}
    .sample-measure h4{margin:0;padding:.35rem .55rem;border-bottom:1px solid #a2a9b1;background:#eaecf0;font-size:.86rem}
    .sample-note{font-size:.82rem;color:#54595d;margin:.7rem 0 0}
    @media(max-width:760px){.sample-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const detailedOpenEntry = openEntry;
  openEntry = function(id, hash = false) {
    detailedOpenEntry(id, hash);
    const entry = entries.find(x => x.id === id);
    if (!entry || !els.dialogContent) return;
    const s = sampleFor(entry);
    const t = text[language];
    const section = document.createElement('section');
    section.className = 'dialog-section detail-section';
    section.innerHTML = `
      <h3>${t.sample}</h3>
      <div class="sample-grid">
        <div class="sample-panel">
          <h4>${t.before}</h4>
          <div class="sample-code"><button class="sample-copy" type="button">${t.copy}</button><pre><code>${esc(s.before)}</code></pre></div>
        </div>
        <div class="sample-panel">
          <h4>${t.after}</h4>
          <div class="sample-code"><button class="sample-copy" type="button">${t.copy}</button><pre><code>${esc(s.after)}</code></pre></div>
        </div>
      </div>
      <div class="sample-measure">
        <h4>${t.measure}</h4>
        <div class="sample-code"><button class="sample-copy" type="button">${t.copy}</button><pre><code>${esc(s.measure)}</code></pre></div>
      </div>
      <p class="sample-note">${t.note}</p>
    `;
    const relatedSection = els.dialogContent.querySelector('.detail-related')?.closest('.dialog-section');
    if (relatedSection) relatedSection.before(section); else els.dialogContent.appendChild(section);
    section.querySelectorAll('.sample-code').forEach(block => {
      const button = block.querySelector('.sample-copy');
      const code = block.querySelector('code');
      button.onclick = async () => {
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = t.copied;
          setTimeout(() => button.textContent = t.copy, 1200);
        } catch (_) {
          button.textContent = t.copy;
        }
      };
    });
  };

  if (location.hash.startsWith('#entry/') && els.dialog?.open) {
    openEntry(location.hash.split('/')[1]);
  }
})();
