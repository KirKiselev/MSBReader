type MSBModel = { vertices: Array<Float32Array>; indices: Array<Uint16Array>; normals: Array<Float32Array>; uvs: Array<Float32Array>; materials: Array<Array<string>> };
export type { MSBModel };

function MSBReader(file: File) {
  const fileExtension = file.name.split(".")[1];

  if (fileExtension !== "msb") throw new Error("Wrong file extention");

  let model: MSBModel = { vertices: new Array(), indices: new Array(), normals: new Array(), uvs: new Array(), materials: new Array() };
  let reader = new FileReader();
  let dataView: DataView | null = null;
  let tmp: any;

  let groupsTotal = 0;
  let readingPosition = 0;

  let verticesInGroup = 0;
  let trianglesInGroup = 0;

  reader.readAsArrayBuffer(file);
  reader.onloadend = () => {
    //@ts-ignore
    dataView = new DataView(reader.result, 0);

    groupsTotal = dataView.getInt16(2, true);
    readingPosition += 8;

    for (let currentGroupNumber = 0; currentGroupNumber < groupsTotal; currentGroupNumber++) {
      verticesInGroup = dataView.getInt32(readingPosition, true);
      readingPosition += 4;
      trianglesInGroup = dataView.getInt32(readingPosition, true);
      readingPosition += 4;

      model.vertices.push(new Float32Array(verticesInGroup * 3));
      model.indices.push(new Uint16Array(trianglesInGroup * 3));
      model.normals.push(new Float32Array(verticesInGroup * 3));
      model.uvs.push(new Float32Array(verticesInGroup * 2));
      model.materials.push(new Array());

      for (let currentVerticeNumber = 0; currentVerticeNumber < verticesInGroup; currentVerticeNumber++) {
        model.vertices[currentGroupNumber][currentVerticeNumber * 3] = dataView.getFloat32(readingPosition, true);
        model.vertices[currentGroupNumber][currentVerticeNumber * 3 + 1] = dataView.getFloat32(readingPosition + 4, true);
        model.vertices[currentGroupNumber][currentVerticeNumber * 3 + 2] = dataView.getFloat32(readingPosition + 8, true);

        model.normals[currentGroupNumber][currentVerticeNumber * 3] = dataView.getFloat32(readingPosition + 12, true);
        model.normals[currentGroupNumber][currentVerticeNumber * 3 + 1] = dataView.getFloat32(readingPosition + 16, true);
        model.normals[currentGroupNumber][currentVerticeNumber * 3 + 2] = dataView.getFloat32(readingPosition + 20, true);

        model.uvs[currentGroupNumber][currentVerticeNumber * 2] = dataView.getFloat32(readingPosition + 28, true);
        model.uvs[currentGroupNumber][currentVerticeNumber * 2 + 1] = dataView.getFloat32(readingPosition + 32, true);

        readingPosition += 40;
      }

      for (let currentTriangleNumber = 0; currentTriangleNumber < trianglesInGroup; currentTriangleNumber++) {
        model.indices[currentGroupNumber][currentTriangleNumber * 3] = dataView.getInt16(readingPosition, true);
        model.indices[currentGroupNumber][currentTriangleNumber * 3 + 1] = dataView.getInt16(readingPosition + 2, true);
        model.indices[currentGroupNumber][currentTriangleNumber * 3 + 2] = dataView.getInt16(readingPosition + 4, true);

        readingPosition += 8;
      }

      readingPosition += 18;

      tmp = "";
      while (dataView.getUint8(readingPosition) != 0) {
        tmp += String.fromCharCode(dataView.getUint8(readingPosition));
        readingPosition++;
      }
      model.materials[currentGroupNumber].push(tmp);

      if (dataView.getUint8(readingPosition + 82 - tmp.length) != 0) {
        readingPosition += 82 - tmp.length;
        tmp = "";
        while (dataView.getUint8(readingPosition) != 0) {
          tmp += String.fromCharCode(dataView.getUint8(readingPosition));
          readingPosition++;
        }
        if (!tmp.includes(" ") && tmp.length > 1) {
          model.materials[currentGroupNumber].push(tmp);
        }

        readingPosition += 82 - tmp.length + 26;
      } else {
        readingPosition += 190 - tmp.length;
      }
    }
  };

  return model;
}

export default MSBReader;
