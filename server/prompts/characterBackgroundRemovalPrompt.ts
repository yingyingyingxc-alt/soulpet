export const characterBackgroundRemovalPrompt = `
Identify the main character and remove only the plain background.

Keep the complete character.

Preserve:
hair
eyes
clothes
outline
accessories

Output:
complete character on a pure solid bright green chroma key background
background color exactly #00FF00

Do not crop.
Do not redraw.
Do not modify character appearance.
Do not use a white background.
Do not use a gradient background.
Do not add scenery.
Do not attach a shadow to the background.
`.trim()
