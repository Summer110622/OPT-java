(() => {
  'use strict';

  const labels = {
    ja: {
      mechanism: '内部で何が起きるか',
      when: '適用を検討する条件',
      procedure: '検証手順',
      experiment: '最小実験',
      interpretation: '測定結果の読み方',
      decision: '採用判断',
      pitfalls: '失敗しやすい点',
      environment: '再現のために記録する情報',
      related: '関連項目',
      category: '分類',
      angle: '観点',
      metrics: '主要指標',
      difficulty: '難易度',
      evidence: '必要な根拠',
      easy: '低',
      medium: '中',
      advanced: '高',
      measured: '同条件の変更前後測定',
      permalink: '固定リンク'
    },
    en: {
      mechanism: 'What happens internally',
      when: 'When to consider it',
      procedure: 'Validation procedure',
      experiment: 'Minimal experiment',
      interpretation: 'How to read the results',
      decision: 'Adoption criteria',
      pitfalls: 'Common failure modes',
      environment: 'Record for reproducibility',
      related: 'Related entries',
      category: 'Category',
      angle: 'Angle',
      metrics: 'Primary metrics',
      difficulty: 'Difficulty',
      evidence: 'Evidence required',
      easy: 'Low',
      medium: 'Medium',
      advanced: 'High',
      measured: 'Before/after measurement under equivalent conditions',
      permalink: 'Permalink'
    }
  };

  const categoryGuides = {
    JVM: {
      ja: {
        mechanism: 'HotSpot では bytecode がそのまま一定速度で実行されるわけではありません。インタプリタ、段階的 JIT、プロファイル情報、インライン化、deoptimization、safepoint などが時間とともに実行形態を変えます。したがって JVM 系の最適化では「同じ Java コードでも、いつ・どの compilation level で測ったか」を切り分ける必要があります。',
        checks: ['JFR の Compilation / Deoptimization / Safepoint event を対象時間帯と照合する。', '起動直後と定常状態を別系列として測り、混ぜて平均しない。'],
        metrics: 'CPU sample だけでなく compilation time、code cache、safepoint、deoptimization、startup-to-steady-state の時間軸を合わせて読みます。',
        experiment: '同じ JVM 引数・同じ JDK build でプロセスを複数回起動し、起動直後から定常状態まで throughput / latency と JFR event を時系列で取得します。',
        pitfalls: ['JIT が十分に温まっていない値を定常性能として比較しない。', 'JVM 内部最適化を前提にコードの正しさを変えない。']
      },
      en: {
        mechanism: 'HotSpot does not execute bytecode at one fixed speed. Interpretation, tiered JIT compilation, runtime profiles, inlining, deoptimization and safepoints change execution over time. JVM tuning therefore requires separating when code was measured and which compilation state it was in.',
        checks: ['Correlate JFR Compilation, Deoptimization and Safepoint events with the affected time window.', 'Measure startup and steady state as separate phases rather than averaging them together.'],
        metrics: 'Read CPU samples together with compilation time, code-cache pressure, safepoints, deoptimization and time-to-steady-state.',
        experiment: 'Start the process multiple times with the same JDK build and JVM flags, then capture throughput/latency and JFR events from startup through steady state.',
        pitfalls: ['Do not treat partially warmed-up measurements as steady-state performance.', 'Never depend on a JVM optimization for program correctness.']
      }
    },
    GC: {
      ja: {
        mechanism: 'GC の性能は pause 時間だけでは決まりません。allocation rate、object lifetime、promotion、heap occupancy、concurrent GC が使える CPU 余力の組み合わせで決まります。同じ pause でも回数が増えれば throughput を失い、逆に停止時間を減らす collector が concurrent CPU を多く使う場合もあります。',
        checks: ['GC unified logging と JFR を同じ時間軸で取り、pause 前後の heap occupancy を見る。', 'allocation rate と old generation の増加速度を分離して確認する。'],
        metrics: 'pause p50/p95/p99、GC frequency、allocation bytes/s、promotion、old occupancy、concurrent GC CPU、RSS を同時に追います。',
        experiment: '代表負荷を固定し、heap/collector の変更は一度に一つだけ変えます。最低でも数回の GC cycle を含む十分な時間を測定します。',
        pitfalls: ['最大 pause だけを見て throughput や CPU 増加を見落とさない。', 'heap を大きくするだけで leak や過剰 retention を隠さない。']
      },
      en: {
        mechanism: 'GC performance is not defined by pause time alone. Allocation rate, object lifetime, promotion, heap occupancy and CPU headroom for concurrent work interact. Fewer pauses can still cost more concurrent CPU, while short pauses repeated frequently can reduce throughput.',
        checks: ['Capture unified GC logging and JFR on the same timeline and inspect heap occupancy around pauses.', 'Separate allocation pressure from old-generation growth.'],
        metrics: 'Track pause p50/p95/p99, GC frequency, allocation bytes/s, promotion, old occupancy, concurrent-GC CPU and RSS together.',
        experiment: 'Hold workload constant and change one heap or collector variable at a time. Run long enough to include multiple representative GC cycles.',
        pitfalls: ['Do not optimize maximum pause while ignoring throughput or CPU cost.', 'Do not hide leaks or retention simply by increasing the heap.']
      }
    },
    Memory: {
      ja: {
        mechanism: 'Java のメモリ問題には「毎秒大量に作る allocation pressure」と「長時間残る retained memory」があります。前者は GC 頻度やメモリ帯域を押し上げ、後者は heap/RSS を圧迫します。さらに direct buffer、thread stack、metaspace など heap 外のメモリもあるため、heap 使用量だけでは全体像になりません。',
        checks: ['allocation profile と heap dump / retained size を別々に取得する。', 'RSS と heap committed の差が大きい場合は NMT や native memory を確認する。'],
        metrics: 'bytes/op、allocation bytes/s、object count、retained heap、live set、RSS、native committed memory を用途別に見ます。',
        experiment: '同一リクエストを一定回数処理し、処理前後の allocation と steady-state retained memory を別々に測ります。',
        pitfalls: ['allocation 削減のための pooling が巨大 buffer を長期間保持しないか確認する。', 'heap だけを見て native memory 増加を見落とさない。']
      },
      en: {
        mechanism: 'Java memory problems split into allocation pressure and retained memory. The former drives GC and memory bandwidth; the latter grows the live set. Direct buffers, thread stacks and metaspace also live outside the Java heap, so heap usage alone is incomplete.',
        checks: ['Capture allocation profiles separately from heap-dump retained-size analysis.', 'When RSS greatly exceeds committed heap, inspect native memory with NMT or equivalent tools.'],
        metrics: 'Use bytes/op, allocation bytes/s, object count, retained heap, live set, RSS and native committed memory for different questions.',
        experiment: 'Process a fixed number of identical requests and separately measure transient allocation and steady-state retained memory.',
        pitfalls: ['Object or buffer pools can reduce allocation while increasing retained memory.', 'Do not ignore native memory when heap looks healthy.']
      }
    },
    CPU: {
      ja: {
        mechanism: 'CPU 最適化では命令数だけでなく、アルゴリズム計算量、branch prediction、cache locality、boxing、virtual call、serialization/parsing などが重なります。まず wall-clock のうち本当に CPU 実行が支配しているかを確認し、その後 flame graph の幅が広い経路から削ります。',
        checks: ['async-profiler などで wall-clock と CPU profile を比較する。', '入力サイズを変え、処理時間が線形・対数・二乗のどの増え方をしているか確認する。'],
        metrics: 'CPU time/op、samples、IPC、branch/cache miss（取得可能な場合）、allocation bytes/op、throughput を組み合わせます。',
        experiment: 'JMH または再現可能な end-to-end benchmark で入力サイズを複数用意し、warmup と複数 fork を入れて比較します。',
        pitfalls: ['数 ns の差より計算量や I/O wait の改善を優先する。', 'コンパイラが消せる処理を含む手書き microbenchmark を信用しない。']
      },
      en: {
        mechanism: 'CPU cost comes from more than instruction count: asymptotic complexity, branch prediction, cache locality, boxing, virtual calls, parsing and serialization can all dominate. First confirm that wall-clock time is actually CPU-bound, then work from the widest flame-graph paths.',
        checks: ['Compare wall-clock and CPU profiles with async-profiler or equivalent tooling.', 'Vary input size and identify whether cost scales linearly, logarithmically or quadratically.'],
        metrics: 'Combine CPU time/op, sample share, IPC, branch/cache misses when available, allocation bytes/op and throughput.',
        experiment: 'Use JMH or a reproducible end-to-end benchmark across multiple input sizes, with warmup and multiple forks when appropriate.',
        pitfalls: ['Prioritize algorithmic or wait-time improvements over nanosecond-level instruction tweaks.', 'Avoid handwritten microbenchmarks that the compiler can optimize away.']
      }
    },
    Concurrency: {
      ja: {
        mechanism: '並行性能は thread 数を増やせば単純に伸びるものではありません。lock contention、queueing、context switch、CAS retry、false sharing、下流資源の飽和によって、並列度を上げた時点からむしろ tail latency が悪化します。Little の法則を意識し、in-flight 数・処理時間・throughput を一緒に見ます。',
        checks: ['thread dump / JFR で BLOCKED、park、executor queue、virtual-thread pinning を確認する。', '並列度を段階的に上げ、throughput が頭打ちになる点と p99 が立ち上がる点を探す。'],
        metrics: 'queue depth、blocked/park time、lock contention、active threads、context switches、throughput、p99 を追います。',
        experiment: '1, 2, 4, 8... と並列度を段階的に変え、同じ総仕事量または同じ到着率で性能曲線を作ります。',
        pitfalls: ['無制限 queue で overload を隠さない。', 'CPU-bound workload に過剰な thread を与えて context switch を増やさない。']
      },
      en: {
        mechanism: 'Concurrency does not scale linearly with thread count. Lock contention, queueing, context switching, CAS retries, false sharing and downstream saturation can make tail latency worse beyond a certain level. Track in-flight work, service time and throughput together.',
        checks: ['Use thread dumps or JFR to inspect BLOCKED time, parking, executor queues and virtual-thread pinning.', 'Increase concurrency in stages and locate where throughput flattens and p99 rises sharply.'],
        metrics: 'Track queue depth, blocked/park time, contention, active threads, context switches, throughput and p99.',
        experiment: 'Sweep concurrency through 1, 2, 4, 8... while holding total work or arrival rate constant, then plot the scaling curve.',
        pitfalls: ['Do not hide overload behind unbounded queues.', 'Do not oversubscribe CPU-bound work with excessive threads.']
      }
    },
    'I/O': {
      ja: {
        mechanism: 'I/O では Java メソッド呼び出しそのものより、syscall、copy、page cache、device latency、flush、blocking wait が支配的です。小さな操作を何度も行う固定費と、大きな batch による memory/tail-latency 増加の間に最適点があります。',
        checks: ['read/write 回数、payload size、syscall rate、flush/fsync の頻度を取得する。', 'CPU time と wall-clock の差から I/O wait の比率を確認する。'],
        metrics: 'bytes/s、ops/s、syscalls/s、I/O wait、flush/fsync latency、buffer allocation、p99 を見ます。',
        experiment: 'payload と総転送量を固定して buffer/batch size だけを段階的に変え、throughput と p99 の両方を比較します。',
        pitfalls: ['最大 throughput だけで巨大 buffer/batch を採用しない。', 'OS page cache が効いた再実行と cold I/O を混同しない。']
      },
      en: {
        mechanism: 'I/O is often dominated by syscalls, copying, page cache, device latency, flushes and blocking waits rather than Java call overhead. The optimum lies between repeated tiny operations and oversized batches that increase memory or tail latency.',
        checks: ['Capture read/write counts, payload size, syscall rate and flush/fsync frequency.', 'Compare CPU time with wall-clock time to estimate waiting.'],
        metrics: 'Use bytes/s, ops/s, syscalls/s, I/O wait, flush/fsync latency, buffer allocation and p99.',
        experiment: 'Hold payload and total transferred bytes constant while sweeping buffer or batch size, then compare throughput and p99.',
        pitfalls: ['Do not choose enormous buffers or batches from throughput alone.', 'Do not mix warm page-cache runs with cold I/O measurements.']
      }
    },
    Collections: {
      ja: {
        mechanism: 'コレクション性能は Big-O だけでなく、要素数、resize、hash collision、boxing、node allocation、iteration locality、並行更新率で変わります。少数要素では単純な配列走査が勝ち、大量データでは hash/index 構造が勝つなど、境界値が重要です。',
        checks: ['実際の要素数分布と read/write 比率を取得する。', 'allocation profile で node/wrapper/中間 collection の生成量を見る。'],
        metrics: 'ns/op、bytes/op、retained bytes/element、resize/rehash、collision、read/write throughput を使います。',
        experiment: '現実的な要素数の p50/p95/max を用意し、lookup/add/remove/iteration を別々に比較します。',
        pitfalls: ['最大要素数だけで初期容量を決めてメモリを浪費しない。', 'microbenchmark の単一操作だけで実 workload の混合操作を代表させない。']
      },
      en: {
        mechanism: 'Collection performance depends on element count, resizing, hash collisions, boxing, node allocation, iteration locality and concurrent update rate—not only Big-O. Boundary sizes matter because simple scans may win for tiny sets while indexed structures win later.',
        checks: ['Measure the real element-count distribution and read/write ratio.', 'Use allocation profiling to expose nodes, wrappers and intermediate collections.'],
        metrics: 'Use ns/op, bytes/op, retained bytes/element, resize/rehash counts, collision behavior and mixed read/write throughput.',
        experiment: 'Benchmark realistic p50/p95/max sizes and separate lookup, add, remove and iteration workloads.',
        pitfalls: ['Do not size every collection for the maximum and waste memory.', 'Do not assume a single-operation microbenchmark represents a mixed production workload.']
      }
    },
    Database: {
      ja: {
        mechanism: 'DB 付き Java アプリでは、Java の数 µs より network round trip、SQL plan、index、lock、transaction、connection pool wait が数 ms 単位で支配することが珍しくありません。まず Java/DB の境界を時間分解し、query 数と rows scanned を確認します。',
        checks: ['request あたり query 数と connection-pool wait を計測する。', 'DB の EXPLAIN/実行統計から rows scanned、index 利用、lock wait を確認する。'],
        metrics: 'queries/request、round trips、DB execution time、pool wait、rows scanned/returned、lock wait、p99 を追います。',
        experiment: '同じ DB snapshot と同じ parameter 分布で query 数・batch/fetch size・transaction 境界を一つずつ変えます。',
        pitfalls: ['Java 側の高速化で遅い query plan を隠そうとしない。', '巨大 batch/transaction で lock と retry cost を増やさない。']
      },
      en: {
        mechanism: 'In database-backed Java services, milliseconds of network round trips, plans, indexes, locks, transactions and pool waits often dominate microseconds of Java execution. Break time down across the Java/DB boundary first.',
        checks: ['Measure queries per request and connection-pool wait time.', 'Inspect rows scanned, index usage and lock waits from database execution statistics.'],
        metrics: 'Track queries/request, round trips, DB execution time, pool wait, rows scanned/returned, lock wait and p99.',
        experiment: 'Use the same database snapshot and parameter distribution while changing query count, batch/fetch size or transaction boundaries one at a time.',
        pitfalls: ['Do not use Java micro-optimizations to compensate for a bad query plan.', 'Avoid oversized batches or transactions that increase lock and retry cost.']
      }
    },
    Network: {
      ja: {
        mechanism: 'network latency は DNS、connect、TLS、queue、serialization、packetization、remote service の処理時間の合計です。connection reuse や batching は固定費を減らせますが、retry・timeout・buffering が overload を増幅することもあります。',
        checks: ['DNS/connect/TLS/TTFB/response body を可能な範囲で分解する。', '新規接続率、retry 率、payload bytes、in-flight request を記録する。'],
        metrics: 'RTT、connect/TLS time、requests/connection、bytes/request、retry/timeout rate、p95/p99 を見ます。',
        experiment: '同じ server と payload で connection reuse、batch size、timeout/retry policy のどれか一つだけを変更して比較します。',
        pitfalls: ['retry による追加負荷を成功率だけで見落とさない。', '平均 RTT が低くても p99 timeout を無視しない。']
      },
      en: {
        mechanism: 'Network latency is the sum of DNS, connect, TLS, queueing, serialization, packetization and remote-service time. Connection reuse and batching reduce fixed cost, but retries, timeouts and buffering can amplify overload.',
        checks: ['Break down DNS, connect, TLS, TTFB and response-body time where possible.', 'Record new-connection rate, retries, payload bytes and in-flight requests.'],
        metrics: 'Track RTT, connect/TLS time, requests/connection, bytes/request, retry/timeout rate and p95/p99.',
        experiment: 'Against the same server and payload, change only one of connection reuse, batch size or timeout/retry policy.',
        pitfalls: ['Do not ignore load amplification from retries.', 'Do not let a good mean RTT hide p99 timeouts.']
      }
    },
    Tooling: {
      ja: {
        mechanism: '性能計測ツールはそれぞれ見ているものが違います。JFR は event 相関、async-profiler は sampling stack、JMH は microbenchmark、heap dump は retained graph、NMT は native memory を得意とします。ツール選択を間違えると、正しいデータでも問いに答えられません。',
        checks: ['最初に「CPU / allocation / retention / lock / I/O / latency の何を知りたいか」を明文化する。', 'sampling interval・event threshold・benchmark fork/warmup など計測条件を保存する。'],
        metrics: 'ツール固有指標に加えて必ず end-to-end latency / throughput / error rate を基準として残します。',
        experiment: '同じ負荷を未計測・計測ありで比較し、profiler 自体の overhead が許容範囲か確認します。',
        pitfalls: ['flame graph の幅を wall-clock 寄与と誤読しないなど、各 profiler の sampling semantics を理解する。', '一回の capture だけで再現性を判断しない。']
      },
      en: {
        mechanism: 'Performance tools answer different questions. JFR correlates events, async-profiler samples stacks, JMH controls microbenchmarks, heap dumps show retained graphs and NMT describes native memory. The wrong tool can produce correct data that still does not answer the question.',
        checks: ['State whether the question is CPU, allocation, retention, locks, I/O or latency before choosing a tool.', 'Save sampling intervals, thresholds, benchmark forks/warmup and other measurement settings.'],
        metrics: 'Keep end-to-end latency, throughput and error rate alongside tool-specific metrics.',
        experiment: 'Compare the same workload with and without profiling to quantify observer overhead.',
        pitfalls: ['Understand each profiler’s sampling semantics before interpreting flame-graph width or event counts.', 'Do not conclude reproducibility from one capture.']
      }
    }
  };

  const angleGuides = {
    baseline: {
      ja: {when: '改善前の値がまだなく、性能差を定量化できないとき。', decision: '同じ入力・同じ環境で再測定したときに分散が小さく、比較基準として安定していれば baseline として保存する。', extra: '測定系そのものを変更せず、以後の実験がこの値を参照できるよう commit/JDK/build ID と紐付ける。'},
      en: {when: 'Use this when there is no trustworthy pre-change measurement.', decision: 'Keep the baseline when repeated runs under equivalent conditions are stable enough to compare changes.', extra: 'Tie the result to the commit, JDK and build configuration so later experiments can reproduce it.'}
    },
    diagnose: {
      ja: {when: '遅いことは分かっているが、CPU・GC・lock・I/O のどれが支配的か不明なとき。', decision: '少なくとも一つの支配コストを「全体時間のどれだけを説明するか」まで特定できたら、次の変更対象に進む。', extra: '症状と同じ時間帯の profile を取り、正常時との差分も比較する。'},
      en: {when: 'Use this when the system is slow but the dominant CPU, GC, lock or I/O cost is unknown.', decision: 'Move to a code/configuration change only after a dominant cost explains a meaningful share of end-to-end time.', extra: 'Profile the exact symptom window and compare it with a healthy period.'}
    },
    'quick-win': {
      ja: {when: '明確な無駄処理・重複変換・不要 allocation・不要 round trip が profile 上で確認できるとき。', decision: '可読性をほぼ維持したまま end-to-end 指標が改善し、副作用がなければ採用しやすい。', extra: '最初にアルゴリズムや不要仕事を減らし、低レベル trick は後回しにする。'},
      en: {when: 'Use this when profiles show obvious duplicate work, conversion, allocation or round trips.', decision: 'Prefer the change when end-to-end performance improves without meaningful readability or correctness cost.', extra: 'Remove work and algorithmic waste before low-level tricks.'}
    },
    'deep-tune': {
      ja: {when: '低リスク改善後も支配コストが残り、SLO/容量目標を満たせないとき。', decision: '複雑化・運用負荷を上回る性能利益が複数回の測定で再現し、rollback 可能なら採用を検討する。', extra: 'JVM flag・OS・データ構造変更を同時に行わず、因果を一つずつ確認する。'},
      en: {when: 'Use this after low-risk work when a dominant cost still prevents SLO or capacity targets.', decision: 'Adopt only when repeatable gains outweigh complexity and operational cost and the change is reversible.', extra: 'Do not mix JVM flags, OS changes and code restructuring in one experiment.'}
    },
    latency: {
      ja: {when: '平均は良いのに p95/p99 や timeout が悪い、または burst 時だけ遅くなるとき。', decision: 'p95/p99 が改善し、throughput・error rate・資源使用量に許容できない悪化がなければ採用する。', extra: 'queue time、GC pause、lock wait、remote call の各 percentile を分解する。'},
      en: {when: 'Use this when mean latency looks fine but p95/p99, timeouts or burst behavior are poor.', decision: 'Adopt when tail latency improves without unacceptable throughput, error-rate or resource regressions.', extra: 'Decompose queue time, GC pauses, lock waits and remote-call percentiles.'}
    },
    throughput: {
      ja: {when: 'CPU/DB/network などの飽和で、負荷を増やしても ops/s が伸びなくなったとき。', decision: '同じ SLO 制約下で飽和点が右へ移動し、1 op あたり資源効率が改善すれば有効。', extra: 'throughput 最大点だけでなく、その直前の p99 と error rate を見る。'},
      en: {when: 'Use this when ops/s stops scaling because CPU, database, network or another resource saturates.', decision: 'Prefer changes that move the saturation point while preserving SLOs and improving resource efficiency per operation.', extra: 'Inspect p99 and error rate just before maximum throughput, not only the peak.'}
    },
    memory: {
      ja: {when: 'GC 頻度、RSS、container OOM、cache retention、allocation rate のいずれかが容量制約になっているとき。', decision: '必要メモリ量が減り、CPU/latency/正しさを悪化させず、live set が安定すれば採用候補。', extra: '短命 allocation と長寿命 retention を同じ問題として扱わない。'},
      en: {when: 'Use this when GC frequency, RSS, container OOMs, cache retention or allocation rate limits capacity.', decision: 'Adopt when memory demand falls without harming CPU, latency or correctness and the live set remains stable.', extra: 'Do not treat transient allocation and long-lived retention as the same problem.'}
    },
    scale: {
      ja: {when: '通常負荷では問題ないが、入力サイズ・同時実行数・burst が増えると急激に悪化するとき。', decision: '非線形な崩壊点を把握し、想定ピークに安全マージンを持てるなら容量設計に反映する。', extra: 'x 軸を入力サイズ/並列度、y 軸を latency/throughput/memory として曲線で保存する。'},
      en: {when: 'Use this when behavior is acceptable at normal load but degrades sharply with size, concurrency or bursts.', decision: 'Document the nonlinear failure point and retain enough headroom above expected peak load.', extra: 'Plot input size or concurrency against latency, throughput and memory instead of keeping one number.'}
    },
    regression: {
      ja: {when: '改善を長期維持したい、JDK/依存ライブラリ更新で性能が戻るのを検出したいとき。', decision: 'CI のノイズを上回る有意な悪化だけを検出できる閾値を設定し、false positive が運用可能な範囲なら gate にする。', extra: '高速な smoke benchmark と、重い定期 benchmark を分ける。'},
      en: {when: 'Use this to preserve improvements across code, JDK and dependency changes.', decision: 'Gate only regressions larger than normal benchmark noise, with a false-positive rate the team can operate.', extra: 'Separate fast smoke benchmarks from heavier scheduled performance suites.'}
    },
    pitfalls: {
      ja: {when: '有名な最適化を適用したいが、自分の workload でも効くか確証がないとき。', decision: '「効く条件」と「逆効果の条件」を両方再現でき、適用範囲を明文化できた場合だけ一般化する。', extra: '小さい/大きい入力、低/高並列度、異なる JDK で結果が反転しないか確認する。'},
      en: {when: 'Use this when a well-known optimization sounds attractive but its applicability to your workload is uncertain.', decision: 'Generalize only after reproducing both winning and losing conditions and documenting the applicability boundary.', extra: 'Check small/large inputs, low/high concurrency and relevant JDK versions for reversals.'}
    }
  };

  const difficultyByAngle = {
    baseline: 'easy',
    diagnose: 'medium',
    'quick-win': 'easy',
    'deep-tune': 'advanced',
    latency: 'medium',
    throughput: 'medium',
    memory: 'medium',
    scale: 'advanced',
    regression: 'medium',
    pitfalls: 'medium'
  };

  const styles = document.createElement('style');
  styles.textContent = `
    .detail-facts{width:100%;border-collapse:collapse;margin:.8rem 0 1.2rem;font-size:.88rem}
    .detail-facts th,.detail-facts td{border:1px solid #a2a9b1;padding:.38rem .5rem;text-align:left;vertical-align:top}
    .detail-facts th{width:9rem;background:#eaecf0;font-weight:600}
    .dialog-section.detail-section{margin-top:1.25rem}
    .dialog-section.detail-section h3{font-family:Georgia,'Times New Roman',serif;font-size:1.12rem;border-bottom:1px solid #a2a9b1;padding-bottom:.2rem;margin-bottom:.55rem}
    .detail-numbered{counter-reset:detailstep;padding-left:0;list-style:none}
    .detail-numbered li{counter-increment:detailstep;margin:.55rem 0;padding-left:2rem;position:relative}
    .detail-numbered li::before{content:counter(detailstep);position:absolute;left:0;top:.05rem;min-width:1.35rem;height:1.35rem;line-height:1.35rem;text-align:center;border:1px solid #a2a9b1;background:#f8f9fa;font-size:.78rem}
    .detail-related{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.5rem}
    .detail-related button{font:inherit;font-size:.84rem;color:#0645ad;background:#f8f9fa;border:1px solid #a2a9b1;padding:.25rem .48rem;cursor:pointer}
    .detail-related button:hover{text-decoration:underline;background:#fff}
    .detail-permalink{font-size:.82rem;margin-top:1rem;color:#54595d}
    .detail-permalink a{color:#0645ad}
  `;
  document.head.appendChild(styles);

  function buildRelated(index) {
    const topicIndex = Math.floor(index / angles.length);
    const angleIndex = index % angles.length;
    const sameTopic = [
      entries[topicIndex * angles.length + ((angleIndex + 1) % angles.length)],
      entries[topicIndex * angles.length + ((angleIndex + 2) % angles.length)]
    ];
    const sameCategory = [];
    for (let i = 1; i < topics.length && sameCategory.length < 3; i++) {
      const candidateTopic = topics[(topicIndex + i) % topics.length];
      if (candidateTopic.category === topics[topicIndex].category) {
        sameCategory.push(entries[((topicIndex + i) % topics.length) * angles.length]);
      }
    }
    return [...sameTopic, ...sameCategory].filter(Boolean);
  }

  entries.forEach((entry, index) => {
    const topic = topics[Math.floor(index / angles.length)];
    const angle = angles[entry.rank];
    const guide = categoryGuides[topic.category];
    const angleGuide = angleGuides[angle.id];
    const difficulty = difficultyByAngle[angle.id] || 'medium';

    ['ja', 'en'].forEach(lang => {
      const d = entry[lang];
      const cg = guide[lang];
      const ag = angleGuide[lang];
      const topicName = lang === 'ja' ? topic.ja : topic.en;
      const angleName = lang === 'ja' ? angle.ja : angle.en;
      const originalActions = [...d.actions];

      d.detail = {
        topicName,
        angleName,
        difficulty,
        mechanism: `${lang === 'ja' ? topic.jaNote : topic.enNote} ${cg.mechanism}`,
        when: [
          ag.when,
          lang === 'ja'
            ? `プロファイルまたは時系列で「${topicName}」に関連する指標が end-to-end 性能と相関しているとき。`
            : `When metrics related to ${topicName} correlate with end-to-end performance in profiles or time series.`,
          lang === 'ja'
            ? `主指標（${topic.metrics}）を変更前後で同条件に取得できるとき。`
            : `When the primary metrics (${topic.metrics}) can be collected before and after under equivalent conditions.`
        ],
        procedure: [
          lang === 'ja'
            ? `対象 workload を固定する。入力、並列度、JDK build、JVM flags、heap、主要依存バージョンを記録する。`
            : `Freeze the workload. Record inputs, concurrency, JDK build, JVM flags, heap and important dependency versions.`,
          originalActions[0],
          cg.checks[0],
          originalActions[1],
          cg.checks[1],
          originalActions[2],
          lang === 'ja'
            ? `変更後に同じ workload を複数回再実行し、主指標と end-to-end の p50/p95/p99・throughput・error rate を比較する。`
            : `Repeat the same workload after the change and compare primary metrics plus end-to-end p50/p95/p99, throughput and error rate.`
        ],
        experiment: `${cg.experiment} ${ag.extra}`,
        interpretation: `${d.measure} ${cg.metrics}`,
        decision: ag.decision,
        pitfalls: [d.caution, cg.pitfalls[0], cg.pitfalls[1]],
        environment: lang === 'ja' ? [
          'JDK vendor / exact build / JVM flags',
          'CPU model・core 数・container CPU limit',
          'heap (Xms/Xmx)・collector・container memory limit',
          'OS / kernel・主要依存ライブラリの version',
          '入力サイズ・データ分布・同時実行数・負荷生成条件',
          `この項目の主指標: ${topic.metrics}`
        ] : [
          'JDK vendor / exact build / JVM flags',
          'CPU model, core count and container CPU limit',
          'heap (Xms/Xmx), collector and container memory limit',
          'OS/kernel and major dependency versions',
          'input size, data distribution, concurrency and load-generator settings',
          `Primary metrics for this topic: ${topic.metrics}`
        ],
        related: buildRelated(index)
      };
    });
  });

  openEntry = function(id, hash = false) {
    const entry = entries.find(x => x.id === id);
    if (!entry || !els.dialog) return;
    const d = entry[language];
    const detail = d.detail;
    const l = labels[language];
    const difficultyLabel = l[detail.difficulty] || detail.difficulty;
    const related = detail.related.map(item => {
      const rd = item[language];
      return `<button type="button" data-related-entry="${item.id}">${esc(rd.title)}</button>`;
    }).join('');

    els.dialogContent.innerHTML = `
      <div class="dialog-kicker">${entry.category} · ${entry.tags.slice(0, 5).join(' · ')}</div>
      <h2 class="dialog-title">${esc(d.title)}</h2>
      <p class="dialog-summary">${esc(d.summary)}</p>

      <table class="detail-facts">
        <tr><th>${l.category}</th><td>${esc(entry.category)}</td></tr>
        <tr><th>${l.angle}</th><td>${esc(detail.angleName)}</td></tr>
        <tr><th>${l.metrics}</th><td>${esc(topics[Math.floor(entries.indexOf(entry) / angles.length)].metrics)}</td></tr>
        <tr><th>${l.difficulty}</th><td>${difficultyLabel}</td></tr>
        <tr><th>${l.evidence}</th><td>${l.measured}</td></tr>
      </table>

      <section class="dialog-section detail-section">
        <h3>${l.mechanism}</h3>
        <p>${esc(detail.mechanism)}</p>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.when}</h3>
        <ul class="dialog-bullets">${detail.when.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.procedure}</h3>
        <ol class="detail-numbered">${detail.procedure.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.experiment}</h3>
        <p>${esc(detail.experiment)}</p>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.interpretation}</h3>
        <p>${esc(detail.interpretation)}</p>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.decision}</h3>
        <p>${esc(detail.decision)}</p>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.pitfalls}</h3>
        <ul class="dialog-bullets">${detail.pitfalls.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.environment}</h3>
        <ul class="dialog-bullets">${detail.environment.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>

      <section class="dialog-section detail-section">
        <h3>${l.related}</h3>
        <div class="detail-related">${related}</div>
      </section>

      <p class="detail-permalink">${l.permalink}: <a href="#entry/${entry.id}">#entry/${entry.id}</a></p>
    `;

    els.dialogContent.querySelectorAll('[data-related-entry]').forEach(button => {
      button.onclick = () => openEntry(button.dataset.relatedEntry, true);
    });

    if (!els.dialog.open) els.dialog.showModal();
    if (hash) history.replaceState(null, '', `#entry/${id}`);
  };

  if (location.hash.startsWith('#entry/') && els.dialog?.open) {
    openEntry(location.hash.split('/')[1]);
  }
})();
