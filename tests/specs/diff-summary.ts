import { testSuite, expect } from "manten";
import { summarizeDiff } from "../../src/utils/diff-summary.js";

const headerDiff = `diff --git a/glfw3.h b/glfw3.h
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/glfw3.h
@@ -0,0 +1,5 @@
+#define GLFW_VERSION_MAJOR 3
+#define GLFW_VERSION_MINOR 4
+
+GLFWAPI void glfwInit(void);
+if (window == NULL) return;
+{"minified": "one very long JSON blob that keeps going and gets excluded because it would blow up the token budget way past the one hundred and twenty character line cap"};
`;

const modifiedDiff = `diff --git a/src/main.cpp b/src/main.cpp
index 111..222 100644
--- a/src/main.cpp
+++ b/src/main.cpp
@@ -1,3 +1,4 @@
 int oldFunction(int x);
-int removeMe(int a) {
+int newFunction(int a) {
   return a + 1;
 }
+class App {
`;

export default testSuite(({ describe }) => {
  describe("summarizeDiff", async ({ test }) => {
    test("extracts stat line and skeleton from new file, skips control flow and minified lines", async () => {
      const out = summarizeDiff(headerDiff);
      expect(out).toContain("FILE glfw3.h (+6, -0)");
      expect(out).toContain("#define GLFW_VERSION_MAJOR 3");
      expect(out).toContain("GLFWAPI void glfwInit(void);");
      expect(out).not.toContain("if (window == NULL)");
      expect(out).not.toContain("minified");
    });

    test("keeps removed skeleton lines for modified files", async () => {
      const out = summarizeDiff(modifiedDiff);
      expect(out).toContain("FILE src/main.cpp (+2, -1)");
      expect(out).toContain("int newFunction(int a) {");
      expect(out).toContain("- int removeMe(int a) {");
      expect(out).toContain("class App {");
    });

    test("drops duplicates within a file", async () => {
      const dup = `diff --git a/a.h b/a.h
--- /dev/null
+++ b/a.h
@@ -0,0 +1,5 @@
+#define SHARED 1
+#define SHARED 1
+#define SHARED 1
+void onlyOnce(void);
+void onlyOnce(void);
`;
      const out = summarizeDiff(dup);
      expect(out.match(/#define SHARED/g)).toHaveLength(1);
      expect(out.match(/onlyOnce/g)).toHaveLength(1);
    });

    test("caps output at budget and marks omitted files", async () => {
      const manyFiles = Array.from({ length: 200 }, (_, i) => {
        const lines = Array.from({ length: 20 }, (_, j) => `+void fn${i}_${j}(void);`).join("\n");
        return `diff --git a/f${i}.h b/f${i}.h\nnew file mode 100644\n--- /dev/null\n+++ b/f${i}.h\n@@ -0,0 +1,20 @@\n+#define F${i} 1\n${lines}`;
      }).join("\n");
      const out = summarizeDiff(manyFiles);
      expect(out).toMatch(/^# Condensed diff: 200 files/);
      expect(out).toContain("... and ");
      // kept well under the 30k budget instead of the ~50k raw diff
      expect(out.length).toBeLessThan(31000);
    });

    test("returns original diff when nothing parseable", async () => {
      const weird = "not a unified diff at all";
      expect(summarizeDiff(weird)).toBe(weird);
    });
  });
});
