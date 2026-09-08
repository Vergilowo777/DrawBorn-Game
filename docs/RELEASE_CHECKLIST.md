# Release checklist

Release work is out of scope for phase 0.

- [x] User created and previewed the real `TestScene` in Cocos Creator 3.8.8.
- [x] Verify that direct pnpm workspace import fails in Cocos 3.8.8 with extensionless internal
      module resolution.
- [x] Reopen the integrated project in Cocos Creator 3.8.8 and validate the asset-local shared
      mirror smoke import.
- [x] Confirm Cocos-generated `.meta` files, Canvas component mounting, browser preview, all
      five class IDs in the console, and zero editor errors or warnings.
- [x] Classify Safari's `minimal-ui` viewport warning as a browser compatibility notice rather
      than a game-code error.
- [ ] Validate iOS on physical devices and TestFlight.
- [ ] Validate `wechatgame` output in WeChat Developer Tools and physical devices.
- [ ] Verify main-package size, remote Asset Bundles, cold start, memory, and weak networks.
- [ ] Complete privacy, UGC safety, account deletion, reporting, blocking, and support flows.
- [ ] Re-check current Apple, WeChat, publishing, and regional compliance requirements.
