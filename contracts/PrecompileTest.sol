// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PrecompileTest {

    address private constant EC_ADD = address(0x06);
    address private constant EC_MUL = address(0x07);

    // view function — no transaction needed, instant result
    function testEcAdd(
        uint256 x1, uint256 y1,
        uint256 x2, uint256 y2
    ) external view returns (uint256 x, uint256 y, bool success) {
        bytes memory input = abi.encodePacked(
            bytes32(x1), bytes32(y1),
            bytes32(x2), bytes32(y2)
        );
        bytes memory output;
        (success, output) = EC_ADD.staticcall(input);
        if (success && output.length == 64) {
            (x, y) = abi.decode(output, (uint256, uint256));
        }
    }

    // view function — no transaction needed
    function testEcMul(
        uint256 px, uint256 py,
        uint256 scalar
    ) external view returns (uint256 x, uint256 y, bool success) {
        bytes memory input = abi.encodePacked(
            bytes32(px), bytes32(py),
            bytes32(scalar)
        );
        bytes memory output;
        (success, output) = EC_MUL.staticcall(input);
        if (success && output.length == 64) {
            (x, y) = abi.decode(output, (uint256, uint256));
        }
    }
}