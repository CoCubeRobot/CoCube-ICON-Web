// MicroBlocks Serial Protocol v2.09 - JS实现核心逻辑

// -------------------- 常量定义 --------------------
const FLAG_SHORT = 0xFA;
const FLAG_LONG = 0xFB;
const TERMINATOR = 0xFE;

const MAX_PAYLOAD_SIZE = 240; // BLE: 240字节, 硬件串口: 63字节
const CHUNK_DELAY_MS = 3;
const SEND_DELAY_MS = 80;
const ACK_TIMEOUT_MS = 50;
const DELETE_ALL_DELAY_MS = 100;

const OPCODES = Object.freeze({
  CHUNK_CODE: 0x20, // 32
  DELETE_CHUNK: 0x02,
  START_CHUNK: 0x03,
  STOP_CHUNK: 0x04,
  START_ALL: 0x05,
  STOP_ALL: 0x06,
  GET_VAR_VALUE: 0x07,
  SET_VAR_VALUE: 0x08,
  GET_VAR_NAMES: 0x09,
  CLEAR_VARS: 0x0A,
  GET_CRC: 0x0B,
  GET_VM_VER: 0x0C,
  GET_ALL_CODE: 0x0D,
  DELETE_ALL_CODE: 0x0E,
  SYSTEM_RESET: 0x0F,
  GET_ALL_CRCS: 0x26,
  DELETE_FILE: 0xC8,
  LIST_FILES: 0xC9,
  START_READING_FILE: 0xCB,
  START_WRITING_FILE: 0xCC,
  ACK_CHUNK_RECEIVED: 0x17,
  ACK_ALTERNATE: 0x11,
  PING: 0X1A,
});

// -------------------- 工具函数 --------------------
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function toLE(n, bytes = 2) {
  const arr = new Array(bytes);
  for (let i = 0; i < bytes; i++) {
    arr[i] = (n >> (8 * i)) & 0xFF;
  }
  return arr;
}

function fromLE(arr) {
  return arr.reduce((acc, b, i) => acc + (b << (8 * i)), 0);
}

const strToBytes = (str) => Array.from(new TextEncoder().encode(str));
const bytesToStr = (bytes) => new TextDecoder().decode(Uint8Array.from(bytes));

// -------------------- 消息打包函数 --------------------
function packShort(opcode, id) {
  return Uint8Array.from([FLAG_SHORT, opcode, id]);
}

function packLong(opcode, id, data) {
  const size = data.length + 1;
  const [sizeLSB, sizeMSB] = toLE(size, 2);
  return Uint8Array.from([
    FLAG_LONG, 
    opcode, 
    id, 
    sizeLSB, 
    sizeMSB, 
    ...data, 
    TERMINATOR
  ]);
}

// -------------------- 消息发送 API --------------------
async function sendShortMsg(serialPort, opcode, id) {
  await serialPort.write_data(packShort(opcode, id));
}

async function sendLongMsg(serialPort, opcode, chunkID, data) {
  const fullMessage = packLong(opcode, chunkID, data);

  // 小消息直接发送
  if (data.length <= MAX_PAYLOAD_SIZE - 6) {
    await serialPort.write_data(fullMessage);
    await delay(SEND_DELAY_MS);
    return;
  }

  // 大消息分块发送
  for (let offset = 0; offset < fullMessage.length; offset += MAX_PAYLOAD_SIZE) {
    const chunkData = fullMessage.slice(offset, offset + MAX_PAYLOAD_SIZE);
    await serialPort.write_data(chunkData);
    
    const delayTime = chunkData.length < MAX_PAYLOAD_SIZE 
      ? SEND_DELAY_MS 
      : CHUNK_DELAY_MS;
    await delay(delayTime);
  }
}

// -------------------- 消息解包逻辑 --------------------
function parseMsg(buffer) {
  const flag = buffer[0];
  
  if (flag === FLAG_SHORT && buffer.length >= 3) {
    return { 
      type: "short", 
      opcode: buffer[1], 
      id: buffer[2], 
      data: [] 
    };
  }
  
  if (flag === FLAG_LONG && buffer.length >= 5) {
    const size = fromLE(buffer.slice(3, 5));
    return {
      type: "long",
      opcode: buffer[1],
      id: buffer[2],
      data: buffer.slice(5, 5 + size - 1),
      terminator: buffer[5 + size - 1],
    };
  }
  
  throw new Error(`Unknown message format: 0x${flag.toString(16)}`);
}

// -------------------- IDE → Board 指令封装 --------------------
const sendChunkCode = (serialPort, chunkID, binaryArr) => 
  sendLongMsg(serialPort, OPCODES.CHUNK_CODE, chunkID, binaryArr);

const deleteChunk = (serialPort, chunkID) => 
  sendShortMsg(serialPort, OPCODES.DELETE_CHUNK, chunkID);

const startChunk = (serialPort, chunkID) => 
  sendShortMsg(serialPort, OPCODES.START_CHUNK, chunkID);

const stopChunk = (serialPort, chunkID) => 
  sendShortMsg(serialPort, OPCODES.STOP_CHUNK, chunkID);

const startAll = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.START_ALL, 1);

const stopAll = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.STOP_ALL, 0);

const ping = (serialPort) =>
  sendShortMsg(serialPort, OPCODES.PING, 0);

const getVariableValue = (serialPort, varID) => 
  sendShortMsg(serialPort, OPCODES.GET_VAR_VALUE, varID);

const getVariableValueByName = (serialPort, name) => 
  sendLongMsg(serialPort, OPCODES.GET_VAR_VALUE, 0, strToBytes(name));

async function setVariableValue(serialPort, varID, value) {
  let type, data;
  
  if (typeof value === "number" && Number.isInteger(value)) {
    type = 1;
    data = [type, ...toLE(value, 4)];
  } else if (typeof value === "string") {
    type = 2;
    data = [type, ...strToBytes(value)];
  } else if (typeof value === "boolean") {
    type = 3;
    data = [type, value ? 1 : 0];
  } else {
    throw new Error(`Unsupported variable type: ${typeof value}`);
  }
  
  await sendLongMsg(serialPort, OPCODES.SET_VAR_VALUE, varID, data);
}

const getVariableNames = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.GET_VAR_NAMES, 0);

const clearVariables = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.CLEAR_VARS, 0);

const getChunkCRC = (serialPort, chunkID) => 
  sendShortMsg(serialPort, OPCODES.GET_CRC, chunkID);

const getVMVersion = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.GET_VM_VER, 0);

const getAllCode = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.GET_ALL_CODE, 1);

const deleteAllCode = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.DELETE_ALL_CODE, 1);

const systemReset = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.SYSTEM_RESET, 0);

const getAllCRCs = (serialPort) => 
  sendShortMsg(serialPort, OPCODES.GET_ALL_CRCS, 0);

// -------------------- 消息监听 --------------------
function listenSerial(serialPort, callback) {
  const { feature_SerialInputBuffers } = serialPort;
  
  for (const buffer of feature_SerialInputBuffers) {
    try {
      // 短消息
      if (buffer[0] === FLAG_SHORT && buffer.length >= 3) {
        callback(parseMsg(buffer.slice(0, 3)));
        continue;
      }
      
      // 长消息
      if (buffer[0] === FLAG_LONG && buffer.length >= 5) {
        const size = fromLE(buffer.slice(3, 5));
        if (buffer.length >= 5 + size) {
          callback(parseMsg(buffer.slice(0, 5 + size)));
        }
      }
    } catch (error) {
      console.error('Parse message error:', error);
    }
  }
  
  feature_SerialInputBuffers.length = 0;
}

// -------------------- 文件传输 --------------------
async function sendFileChunk(serialPort, transferID, offset, data) {
  const payload = [
    ...toLE(transferID, 4),
    ...toLE(offset, 4),
    ...data
  ];
  await sendLongMsg(serialPort, 205, 0, payload);
}

async function readByteListsFromFile() {
  const response = await fetch('61_chunks.txt');
  const text = await response.text();
  return text
    .split('\n')
    .map(line => line.trim().split(',').map(byte => parseInt(byte, 16)))
    .filter(list => list.length > 0);
}

// // -------------------- 批量发送 --------------------
// async function waitForAcknowledgment(bleSerial) {
//   return new Promise((resolve) => {
//     const timeout = setTimeout(() => {
//       console.warn('Timeout waiting for acknowledgment');
//       resolve(false);
//     }, ACK_TIMEOUT_MS);

//     listenSerial(bleSerial, (data) => {
//       if (data.opcode === OPCODES.ACK_CHUNK_RECEIVED || 
//           data.opcode === OPCODES.ACK_ALTERNATE) {
//         clearTimeout(timeout);
//         resolve(true);
//       }
//     });
//   });
// }

async function sendByteList(bleSerial, byteLists, progressCallback) {
  await deleteAllCode(bleSerial);
  await delay(DELETE_ALL_DELAY_MS);

  const total = byteLists.length;

  for (let i = 0; i < total; i++) {
    const byteList = byteLists[i];
    let success = false;

    while (!success) {
      try {
        if (byteList[0] === 0xFB) {
            const chunkID = byteList[2];
            const size = byteList[3] | (byteList[4] << 8);
            const data = byteList.slice(5, 5 + size);
            await sendChunkCode(bleSerial, chunkID, data);
        }
        else{
          await sendChunkCode(bleSerial, i, byteList);
        }
        console.log(`Sent chunk ${i}/${total}`);

        // success = await waitForAcknowledgment(bleSerial);
        // delay 50ms instead of waiting for ack
        await delay(ACK_TIMEOUT_MS);
        success = true;

        if (!success) {
          console.warn(`Retrying chunk ${i}`);
        }

        progressCallback?.(i + 1, total);
      } catch (error) {
        console.error(`Error sending chunk ${i}:`, error);
        break;
      }
    }
  }

  await delay(DELETE_ALL_DELAY_MS);
  await startAll(bleSerial);
}

// -------------------- 导出 --------------------
export { 
  sendByteList,
  sendChunkCode,
  deleteChunk,
  startChunk,
  stopChunk,
  startAll,
  stopAll,
  ping,
  getVariableValue,
  setVariableValue,
  deleteAllCode,
  systemReset,
  listenSerial,
  bytesToStr,
};