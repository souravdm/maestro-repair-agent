/// Instrumentation the repair agent depends on. Add to the app's test/profile
/// flavor only — it emits three signals and nothing else.
///
///   1. [NAV]  route pushes and pops         -> route_stack, expected_route
///   2. [SEMANTICS] enabled/disabled         -> distinguishes 'no ids' from 'no tree'
///   3. [FLAGS] resolved feature flags       -> a flag flip is not a UI regression
///
/// Wire up in main():
///   runApp(MaterialApp(navigatorObservers: [RepairAgentNavObserver()], ...));
///   RepairAgentProbe.emitStartup(flags: resolvedFlags);
library repair_agent_probe;

import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/widgets.dart';

class RepairAgentNavObserver extends NavigatorObserver {
  void _emit(String op, Route<dynamic>? route) {
    final name = route?.settings.name ?? route?.runtimeType.toString() ?? 'unknown';
    developer.log('[NAV] $op $name', name: 'repair_agent');
    debugPrint('[NAV] $op $name');
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _emit('push', route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _emit('pop', route);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      _emit('replace', newRoute);
}

class RepairAgentProbe {
  /// Call once after binding initialization.
  static void emitStartup({Map<String, Object?> flags = const {}}) {
    final enabled = SemanticsBinding.instance.semanticsEnabled;
    debugPrint('[SEMANTICS] ${enabled ? "enabled" : "disabled"} semanticsEnabled=$enabled');
    if (flags.isNotEmpty) {
      debugPrint('[FLAGS] ${flags.entries.map((e) => "${e.key}=${e.value}").join(",")}');
    }

    // Semantics can come up late; report the transition too.
    SemanticsBinding.instance.addSemanticsEnabledListener(() {
      final now = SemanticsBinding.instance.semanticsEnabled;
      debugPrint('[SEMANTICS] ${now ? "enabled" : "disabled"} semanticsEnabled=$now');
    });

    // Surface framework errors on one line so the log scanner can catch them.
    final prior = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      debugPrint('EXCEPTION CAUGHT BY ${details.library}: ${details.exceptionAsString()}');
      prior?.call(details);
    };
  }

  /// Optional: expose the current route as a semantics node so a flow can wait
  /// on it directly (`id: "route:/pharmacy/refill"`).
  static Widget routeBeacon({required String route, required Widget child}) {
    return Semantics(
      identifier: 'route:$route',
      container: true,
      child: child,
    );
  }
}
