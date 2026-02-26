"""Split a TTS card sheet image into individual card images.

Usage:
  python split_cards.py <input_image> <cols> <rows> [--output-dir DIR] [--skip r,c r,c ...]

Example:
  python split_cards.py card_face_1a703fdfd12a.jpg 7 6 --skip 5,5 5,6
  python split_cards.py card_face_1a703fdfd12a.jpg 7 6 --skip 5,5 5,6 --delete-source
"""

import argparse
import os
from pathlib import Path

from PIL import Image


def split_card_sheet(image_path, cols, rows, output_dir, skip_positions=None):
    """Split a card sheet into individual card images."""
    skip_positions = skip_positions or set()
    img = Image.open(image_path)
    width, height = img.size
    card_w = width // cols
    card_h = height // rows

    os.makedirs(output_dir, exist_ok=True)

    sheet_id = Path(image_path).stem
    cards = []
    skipped = 0

    for row in range(rows):
        for col in range(cols):
            if (row, col) in skip_positions:
                skipped += 1
                continue

            idx = row * cols + col
            left = col * card_w
            top = row * card_h
            right = left + card_w
            bottom = top + card_h

            card_img = img.crop((left, top, right, bottom))
            card_name = f"{sheet_id}_r{row}_c{col}.jpg"
            card_path = os.path.join(output_dir, card_name)
            card_img.save(card_path, quality=95)
            cards.append({
                'index': idx,
                'row': row,
                'col': col,
                'filename': card_name,
                'path': card_path,
            })

    print(
        f"Split {image_path} ({width}x{height}) into {len(cards)} cards "
        f"({cols}x{rows} grid, {card_w}x{card_h}px each, {skipped} skipped)"
    )
    print(f"Output: {output_dir}/")
    return cards


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Split TTS card sheet')
    parser.add_argument('image', help='Input card sheet image')
    parser.add_argument('cols', type=int, help='Number of columns')
    parser.add_argument('rows', type=int, help='Number of rows')
    parser.add_argument(
        '--output-dir', default=None,
        help='Output directory (default: processed/<sheet_id>)'
    )
    parser.add_argument(
        '--skip', nargs='*', default=[],
        help='Positions to skip as row,col (e.g. 5,5 5,6)'
    )
    parser.add_argument(
        '--delete-source', action='store_true',
        help='Delete the source image after successful split'
    )
    args = parser.parse_args()

    if args.output_dir is None:
        sheet_id = Path(args.image).stem
        args.output_dir = os.path.join('processed', sheet_id)

    skip = set()
    for pos in args.skip:
        r, c = pos.split(',')
        skip.add((int(r), int(c)))

    cards = split_card_sheet(
        args.image, args.cols, args.rows, args.output_dir, skip
    )

    if args.delete_source and cards:
        os.remove(args.image)
        print(f"Deleted source: {args.image}")
