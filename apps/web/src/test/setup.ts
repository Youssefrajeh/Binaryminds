import { configure } from "@testing-library/react";

// findBy* and waitFor give up after 1 second by default. When the machine is
// busy (the full suite in parallel, a dev server running), reading a file or
// rendering a page can take longer, and tests failed without any real bug.
configure({ asyncUtilTimeout: 5000 });
