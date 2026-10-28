"""Chrome이 띄우는 진입점: python -m core.native_main"""
import os
import sys

from core.native_host import NativeHost, native_loop


def main():
    if os.name == 'nt':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    host = NativeHost()
    try:
        native_loop(host, sys.stdin.buffer, sys.stdout.buffer)
    finally:
        host.close()


if __name__ == '__main__':
    main()
