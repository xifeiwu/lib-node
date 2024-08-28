// const incomingMessage = new HttpIncomingMessage(socket);
// await incomingMessage.parse();
// // logColorful({color: 'yellow'}, 'headerPart Info:', incomingMessage.headerPartProps);
// // watchSocketState(socket, {colorStyle: {color: 'yellow'}, bytesToPrint: 300});
// const data = await getDataFromReadable(incomingMessage);
// const requestInfo = {
//   ...incomingMessage.headerPartProps,
//   data: data.toString(),
// };
// socket.end(
//   responseInfoToBuffer({
//     data: requestInfo,
//   })
// );