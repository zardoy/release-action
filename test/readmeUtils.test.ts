/// <reference types="jest" />

import { markdownRemoveHeading } from '../src/library/readmeUtils'

test('Removes heading', async () => {
    expect(
        await markdownRemoveHeading(
            `
    # Name

    > Introduction

    ## Test Remove ME

    Some Text

    ### Another heading

    Content...
    ## Continue to go
    ...
    `,
            'Test Remove ME',
        ),
    ).toMatchInlineSnapshot()
})
