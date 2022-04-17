declare module "@vlasky/quoted-printable" {
  function decode(
    buffer: Buffer,
    options: {
      qEncoding: boolean;
    }
  ): Buffer;
}
