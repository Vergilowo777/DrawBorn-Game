# DrawBorn phase 1.2 Cocos drawing spike

This is a small capability-validation component, not the phase 1.3 drawing
screen. The pure domain code uses a 1024×1024 RGBA byte buffer and the
`DrawingDocument`/`DrawingStroke` contract. Round dots and line segments are
rasterized into a per-stroke coverage mask. The mask is composited once, which
keeps marker opacity independent of the number of move events in one stroke.
An eraser sets the covered pixels to RGBA `(0, 0, 0, 0)`; it never paints a
background colour. PNG encoding is dependency-free (stored DEFLATE blocks,
CRC-32 and Adler-32). Thumbnails use premultiplied-alpha box averaging.
The Cocos adapter converts both mouse and touch UI locations with
`UITransform.convertToNodeSpaceAR`, then applies non-default anchors in one
pure mapping helper. Pointer cancellation rolls back the in-progress stroke;
only an explicit end commits it. Texture upload row handling is isolated in
`texture-orientation.ts` (currently an explicit top-left row-preserving
adapter).

The audit fix uses node UI mouse-down/move events for `getUILocation()`;
there is no global mouse-move listener. Only the left mouse button can start
a stroke. Node `MOUSE_LEAVE` ends and commits the active mouse stroke at its
last sampled point, rather than cancelling it. Node/global `MOUSE_UP` calls
the same idempotent end handler without reading coordinates, so later releases
do not commit twice. Touch ownership and cancellation rollback are unchanged.
A source guard checks these registrations and handlers without loading `cc`.

Local Cocos Creator 3.8.8 Web Preview testing on macOS Safari established this
desktop right-click sequence: TOUCH_START (`simulate === false`, touch ID 0),
MOUSE_DOWN (button 2), TOUCH_END, then MOUSE_UP (button 2). The touch event
arrived before the mouse left-button check and painted a dot. The previous
`event.simulate` guard therefore failed and has been removed; that flag is
not a right-click protection mechanism in this environment.

Each binding session now selects exactly one route via the public `cc.sys`
API: `sys.isMobile` selects touch-only listeners; otherwise only node mouse
listeners and global coordinate-free MOUSE_UP are registered. The component
stores the bound input mode and uses that saved mode for symmetric removal,
without re-reading `sys.isMobile` during unbinding. Repeated binding/unbinding
is guarded, and disabling still cancels active input. AST tests inspect the
actual mutually exclusive registration/removal branches, not just the presence
of a platform-detection string.

This spike targets desktop Web mouse input and mobile real-touch input.
Desktop touchscreens and mouse peripherals on mobile are not supported by
this deliberate single-route policy. Real mobile touch ownership and
cancellation rollback remain unchanged. No DOM listener, context-menu
suppression or browser global is used.

For the Safari retest, clear the canvas and enable the component, then repeat
the two-finger secondary click and ordinary right/middle clicks. Diagnostics
must remain at zero strokes, zero samples and 1048576 transparent pixels,
with no painted dot. Also verify left-button drawing, leaving/releasing,
real-touch drawing, second-finger rejection and real-touch cancellation
rollback. Repeat component disable/enable and verify there are no duplicate
listeners or strokes. The mutually exclusive input-route fix is awaiting
independent audit and another local Cocos/Safari retest; static tests do not
establish runtime success.

The engine constructor delegates the complete initial draft to the mirrored
phase 1.1 `validateDrawingDraft`: ID format/length, integer revision range,
schema version and fixed canvas dimensions share the authoritative validation
rules. Tests also validate returned drafts against the canonical validator.
The decoded thumbnail regression checks all four RGBA channels at the four
corners and erased centre, using independent Node zlib decompression and CRC
checks.

## Local Cocos Creator 3.8.8 recipe

1. Open `apps/game-client` in Cocos Creator 3.8.8 and wait for asset import.
2. Confirm the phase 1.1 shared modules have no compiler errors. The component
   imports their mirrored runtime values through `assets/shared`; it does not
   import a workspace package or Zod.
3. In the editor, create a temporary capability-validation scene named
   `DrawingSpikeScene`. Do not replace or delete `TestScene`.
4. Under Canvas create a UI node named `Drawing`, size 512×512, anchor
   (0.5, 0.5), with UITransform and Sprite on the same node. Put a coloured
   background (or checkerboard made from alternating coloured UI sprites)
   behind Drawing as an earlier sibling, not inside its exported pixels.
   Add a Label node named `Diagnostics` outside the drawing area.
   Use the default Canvas UI camera and a 1:1 display for the first check.
5. Add the script registered as `DrawBornDrawingSpike` (`DrawingSpike.ts`)
   to Drawing. Connect `Display Sprite` to that same node's Sprite and
   `Drawing Area` to its UITransform. Use a white Sprite tint, SIMPLE type,
   normal alpha blending, no custom material, and no BlockInputEvents overlay.
   Set an
   artwork ID and positive revision in the Inspector.
   The callable spike surface is `setTool("pencil" | "marker" | "eraser")`,
   `setColor("#rrggbb[aa]")`, `setLineWidth(width)`, `clear()`,
   `loadTestPattern()`, `exportArtwork()`, `exportThumbnail()`, and
   `getDiagnostics()`.
6. Run **Web Preview**. First initialize the console variables shown in
   step 10 (steps 7–9 use them). Call `spike.setTool("pencil")`,
   `spike.setColor("#ff0000")`, and `spike.setLineWidth(8)`, then draw.
   Switch with `spike.setTool("marker")` and draw crossing strokes.
   Switch with `spike.setTool("eraser")`, width 32, and cross a
   line with the eraser and confirm the checkerboard/background is visible
   through it (not white paint).
7. In the browser console, run `spike.loadTestPattern()`. Check red/green/blue
   at the top-left/top-right/bottom-left and transparency at the bottom-right
   and in the erased centre.
8. In the browser console, run `spike.exportArtwork()` and
   `spike.exportThumbnail()` using the `showPng` helper below. Check PNG
   signature, original size 1024×1024, thumbnail size 256×256, orientation,
   RGBA channels, and alpha-zero erased pixels.
9. Repeat clear, drawing and export at least ten times and record any errors.
10. In the Web Preview browser console, use this exact temporary-scene lookup
    (rename only the nodes if your scene uses different names):

    ```js
    const scene = cc.director.getScene();
    const canvas = scene.getChildByName("Canvas");
    const drawing = canvas.getChildByName("Drawing");
    const spike = drawing.getComponent("DrawBornDrawingSpike");
    const label = canvas.getChildByName("Diagnostics").getComponent(cc.Label);
    label.string = JSON.stringify(spike.getDiagnostics(), null, 2);
    ```

    The diagnostic reports logical size, local UITransform size, world-scaled
    display bounding size, stroke/sample counts, last export dimensions and
    kind, PNG byte length, transparent pixels, artwork identity, shared import
    probe, and `lastError`.

11. In that browser console, inspect exports without adding browser APIs to
    runtime code:

    ```js
    const showPng = (result) => {
      const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mimeType }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };
    showPng(spike.exportArtwork());
    showPng(spike.exportThumbnail());
    ```

    For decoded pixel verification, the following helper is **browser-console
    only**, never an import in the Cocos runtime. Load the test pattern first;
    the returned probes must be red, green, blue, transparent, transparent.

    ```js
    const inspectPng = async (result) => {
      const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mimeType }));
      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        const preview = document.createElement("canvas");
        preview.width = image.naturalWidth;
        preview.height = image.naturalHeight;
        const context = preview.getContext("2d");
        context.drawImage(image, 0, 0);
        const probes = [
          [0.125, 0.125],
          [0.875, 0.125],
          [0.125, 0.875],
          [0.875, 0.875],
          [0.5, 0.5]
        ].map(([x, y]) =>
          Array.from(
            context.getImageData(
              Math.floor(x * preview.width),
              Math.floor(y * preview.height),
              1,
              1
            ).data
          )
        );
        return { width: preview.width, height: preview.height, probes };
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    spike.loadTestPattern();
    console.log(await inspectPng(spike.exportArtwork()));
    console.log(await inspectPng(spike.exportThumbnail()));
    ```

12. Repeat exactly ten cycles in the same console and record diagnostics:

    ```js
    const runs = [];
    for (let i = 0; i < 10; i += 1) {
      spike.clear();
      spike.setTool("pencil");
      spike.setColor("#ff0000");
      spike.setLineWidth(8);
      spike.loadTestPattern();
      const artwork = spike.exportArtwork();
      const thumbnail = spike.exportThumbnail();
      runs.push({
        ...spike.getDiagnostics(),
        artworkBytes: artwork.bytes.length,
        thumbnailBytes: thumbnail.bytes.length
      });
    }
    console.table(runs);
    ```

13. Also repeat ten **manual** clear → mouse-draw → erase → export cycles;
    the console loop tests repeatable raster/export work, not real input.
    Check a single click at width 1, leaving the canvas while pressed, repeated
    releases, component disable/re-enable, and (on touch hardware) a second
    finger and touch cancellation. Cancellation must remove the partial stroke.
    Repeat with anchor (0.25, 0.75), Drawing scale (0.5, 1.5), then restore them.
    Check that the preview and exported corners agree; custom UI cameras and
    other rendering backends remain outside this initial recipe.
    Right/middle clicks must not start strokes. Leaving Drawing while the
    left button is held must commit once; re-entering without a new left-button
    press must not resume drawing, and releasing outside must not add a stroke.
    Verify mouse alignment with a scaled Canvas as well as the node transforms.
14. Save the temporary scene so Cocos generates its real UUID and `.meta`
    files. Replit does not create or fake scene UUIDs or write new `.meta`
    files.

This environment can compile and test the pure implementation but cannot
claim that Cocos editor rendering, Web Preview input, or Texture2D behaviour
has passed. The local step above is the required runtime check. Only Web
Preview is in scope; iOS and WeChat Mini Game require later validation. The
existing `TestScene` must remain in the project.

All new code is a technical spike, not a production-ready drawing system.
The rasterizer and PNG/thumbnail functions produce real tested output, while
the editor scene setup and Cocos texture adapter still require the local manual
check. Rasterization rebuilds stroke masks on movement; PNG uses uncompressed
DEFLATE and temporary arrays (large output and memory use). Neither performance
nor mobile memory budgets have been validated. Marker opacity is colour alpha
times 0.5, applied once per stroke coverage; separate strokes source-over blend.
Minimum-width single clicks receive minimum pixel coverage at integer corners.
The artwork ID/revision is caller-supplied for a spike session, not an automatic
revision scheduler. The row-preserving orientation
choice must be checked visually in Web Preview; if a backend needs a vertical
flip, change only `texture-orientation.ts`. No upload, filesystem write,
persistence, UI toolbar, undo history, AI, hero confirmation or combat is
included.

The pinned TypeScript check covers the pure domain/export/probe/row adapter.
The engine component has static boundary and TypeScript 4.1 syntax checks only;
these are not semantic checking against Cocos engine declarations. Cocos 3.8.8
must compile it locally. Its nullable EventTouch.getID() is guarded according
to the engine v3.8.8 source.
