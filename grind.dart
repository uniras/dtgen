import 'package:cli_pkg/cli_pkg.dart' as pkg;
import 'package:grinder/grinder.dart';

void main(List<String> args) {
  pkg.jsModuleMainLibrary.value = "lib/main.dart";
  pkg.addAllTasks();
  grind(args);
}
