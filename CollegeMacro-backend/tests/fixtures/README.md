# Test fixtures

- `umich/` - real pages saved from dining.umich.edu.
- `css-selectors-*` - small synthetic pages exercising the generic selector-driven adapter.
- `nutrislice/`, `dineoncampus/`, `purdue/` - **hand-built** responses that follow the
  field names used by working open-source clients of each API (see the header comment
  in each adapter). The build environment could not reach the vendor APIs. Replace them
  with captured responses on the first live run:

  ```bash
  npm run capture -- --school=ohio-state   # writes tests/fixtures/captured/<school>/...
  ```
