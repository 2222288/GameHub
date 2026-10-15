const C = (...x: number[]) => String.fromCharCode(...x);
export async function confirmDanger(message: string) {
  return window.confirm(
    message || C(30830, 23450, 25191, 34892, 34892, 34892, 27492, 25805, 20316, 21527, 65311),
  );
}
