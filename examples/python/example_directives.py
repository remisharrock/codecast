# Matrix

#! matrix = showArray2D(matrix, rowCursors=[line], colCursors=[col], rows=2, cols=3)
matrix = [[0, 0, 0], [0, 0, 0]]
for line in range(0, 2):
    for col in range(0, 3):
        matrix[line][col] = line * 10 + col


# Array

#! arr = showArray(arr, cursors=[index], cursorRows=20)
arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
for index in range(0, 20):
    arr[index] = index * 10




# Matrix scope

def initMatrix():
    for line in range(0, 2):
        for col in range(0, 3):
            matrix[line][col] = line * 10 + col

#! matrix = showArray2D(matrix, rowCursors=[line], colCursors=[col], rows=2, cols=3)
matrix = [[0, 0, 0], [0, 0, 0]]
initMatrix()