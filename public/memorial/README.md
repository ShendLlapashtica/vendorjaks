# Memorial photographs

Drop your image files in this folder and reference them from
`src/content/argument.js` as `photo.src = '/memorial/<filename>'`.

## Why this folder is empty

No photographs were sourced or embedded by the build. Two reasons, both
deliberate:

1. **Rights.** Photographs of Kosovo 1998-99, Srebrenica and Vukovar are
   owned by the agencies, journalists and archives that made them. Shipping
   them without a licence would expose the project.

2. **Accuracy.** Misattributed atrocity photographs are a well-documented
   problem — an image labelled as one massacre that turns out to be from
   another war is exactly the kind of error that discredits everything else
   on the page, including the parts that are correctly sourced from court
   records. Vendorja's whole credibility rests on not doing that.

So: supply images you hold the rights to, or that are cleared for this use,
and caption each one with its source.

## How they render

The app renders every memorial photo in **black and white** (owner's
instruction, 2026-09-12) via a CSS `grayscale(1)` filter — so you can drop
in a colour original and it will still display mono. No need to convert
first.

Recommended: JPEG or WebP, max 1600px on the long edge, under ~300KB each.

## Captions

Each entry in `src/content/argument.js` carries:

```js
photo: {
  src: '/memorial/recak-1999.jpg',
  caption: 'English caption naming what this shows and who took it',
  captionSq: 'Albanian caption',
  creditRequired: true,
}
```

A photo with no caption and no credit will not be rendered — that is
enforced in the component, not left to discipline.
