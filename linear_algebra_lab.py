"""
Interactive Linear Algebra Laboratory - Python Companion Script
=============================================================
This script provides clean, readable NumPy implementations corresponding
directly to each of the 17 phases in the interactive 3D laboratory.

Run this script directly:
    python linear_algebra_lab.py
"""

import sys
import io
import time
import numpy as np

# Ensure clean UTF-8 console output across all platforms
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


def separator(phase_num, title):
    print("\n" + "=" * 60)
    print(f"  PHASE {phase_num}: {title.upper()}")
    print("=" * 60)


def phase_1_vector():
    separator(1, "A Vector")
    v = np.array([3.0, 2.0, 1.0])
    print(f"Vector v: {v}")
    print(f"Components: x = {v[0]}, y = {v[1]}, z = {v[2]}")
    print("Intuition: A vector represents a displacement in space from the origin.")


def phase_2_vector_length():
    separator(2, "Vector Length (Magnitude)")
    v = np.array([3.0, 2.0, 1.0])
    length = np.linalg.norm(v)
    pythagoras_manual = np.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
    print(f"Vector v: {v}")
    print(f"|v| via np.linalg.norm: {length:.4f}")
    print(f"|v| via sqrt(x^2 + y^2 + z^2): {pythagoras_manual:.4f}")
    print("Intuition: Length is Euclidean distance (Pythagoras applied in 3D).")


def phase_3_addition():
    separator(3, "Vector Addition (a + b)")
    a = np.array([3.0, 1.0, 0.0])
    b = np.array([1.0, 2.0, 0.0])
    result = a + b
    print(f"a = {a}")
    print(f"b = {b}")
    print(f"a + b = {result}")
    print(f"Component arithmetic: [{a[0]}+{b[0]}, {a[1]}+{b[1]}, {a[2]}+{b[2]}]")
    print("Intuition: Geometrically follows the parallelogram / tip-to-tail path.")


def phase_4_subtraction():
    separator(4, "Vector Subtraction (a - b)")
    a = np.array([3.0, 1.0, 0.0])
    b = np.array([1.0, 2.0, 0.0])
    result = a - b
    print(f"a = {a}")
    print(f"b = {b}")
    print(f"a - b = {result}")
    print("Intuition: a - b is the displacement pointing from the tip of b to the tip of a.")


def phase_5_scalar_multiplication():
    separator(5, "Scalar Multiplication")
    v = np.array([2.0, 1.0, 1.0])
    for c in [2.0, 0.5, 0.0, -1.0]:
        scaled = c * v
        print(f"Scalar {c:4.1f} * {v} = {scaled}")
    print("Intuition: Positive scales length, 0 collapses to origin, negative reverses direction.")


def phase_6_dot_product():
    separator(6, "Dot Product & Projection")
    a = np.array([3.0, 0.0, 0.0])
    # Angle 0 deg, 90 deg, 180 deg
    b_same = np.array([2.0, 0.0, 0.0])
    b_perp = np.array([0.0, 2.0, 0.0])
    b_opp = np.array([-2.0, 0.0, 0.0])

    print(f"a . b_same (0 deg):    {np.dot(a, b_same):.2f} (Positive: same direction)")
    print(f"a . b_perp (90 deg):   {np.dot(a, b_perp):.2f} (Zero: perpendicular/orthogonal)")
    print(f"a . b_opp  (180 deg): {np.dot(a, b_opp):.2f} (Negative: opposing direction)")
    print("Intuition: a . b measures directional alignment and geometric projection.")


def phase_7_cross_product():
    separator(7, "Cross Product & Parallelogram Area")
    a = np.array([3.0, 0.0, 0.0])
    b = np.array([0.0, 2.0, 0.0])
    cross = np.cross(a, b)
    area = np.linalg.norm(cross)
    print(f"a = {a}")
    print(f"b = {b}")
    print(f"a x b = {cross}")
    print(f"|a x b| = {area:.2f} (Area of rectangle/parallelogram formed by a and b)")
    print("Intuition: Result is perpendicular to both input vectors.")


def phase_8_basis_vectors():
    separator(8, "Basis Vectors & Coordinate Systems")
    i = np.array([1.0, 0.0, 0.0])
    j = np.array([0.0, 1.0, 0.0])
    k = np.array([0.0, 0.0, 1.0])
    v = 3.0 * i + 2.0 * j + 1.0 * k
    print(f"Basis vectors: i={i}, j={j}, k={k}")
    print(f"Linear combination: 3*i + 2*j + 1*k = {v}")
    print("Intuition: Coordinates are simply weights of the standard basis vectors.")


def phase_9_matrices_as_machines():
    separator(9, "Matrices as Transformation Machines")
    M = np.array([[2.0, 0.0],
                  [0.0, 1.0]])
    v = np.array([3.0, 2.0])
    v_transformed = M @ v
    print(f"Matrix M (Stretch X):\n{M}")
    print(f"Input v: {v} -> Output M @ v: {v_transformed}")
    print("Intuition: A matrix takes an input vector and transforms it to an output vector.")


def phase_10_transform_entire_grid():
    separator(10, "Transforming the Entire Grid")
    # Shear matrix
    M = np.array([[1.0, 1.5],
                  [0.0, 1.0]])
    i_hat = np.array([1.0, 0.0])
    j_hat = np.array([0.0, 1.0])
    print(f"Where standard basis i lands: M @ [1, 0] = {M @ i_hat}")
    print(f"Where standard basis j lands: M @ [0, 1] = {M @ j_hat}")
    print("Intuition: The columns of M are exactly the landing sites of the basis vectors.")


def phase_11_matrix_vector_arithmetic():
    separator(11, "Matrix x Vector Component Arithmetic")
    M = np.array([[2.0, 1.0],
                  [1.0, 3.0]])
    v = np.array([4.0, 2.0])
    new_x = M[0, 0] * v[0] + M[0, 1] * v[1]
    new_y = M[1, 0] * v[0] + M[1, 1] * v[1]
    print(f"Row 1 dot v: ({M[0,0]}*{v[0]}) + ({M[0,1]}*{v[1]}) = {new_x}")
    print(f"Row 2 dot v: ({M[1,0]}*{v[0]}) + ({M[1,1]}*{v[1]}) = {new_y}")
    print(f"M @ v = {M @ v}")


def phase_12_matrix_multiplication_order():
    separator(12, "Matrix Multiplication (AB != BA)")
    # A: 90 deg rotation, B: Shear
    A = np.array([[0.0, -1.0],
                  [1.0,  0.0]])
    B = np.array([[1.0, 1.5],
                  [0.0, 1.0]])
    AB = A @ B
    BA = B @ A
    print(f"Matrix A (Rotate):\n{A}\n")
    print(f"Matrix B (Shear):\n{B}\n")
    print(f"AB (Shear then Rotate):\n{AB}\n")
    print(f"BA (Rotate then Shear):\n{BA}\n")
    print(f"Are AB and BA equal? {np.array_equal(AB, BA)}")
    print("Intuition: Sequence of transformations matters! Matrix multiplication is non-commutative.")


def phase_13_determinant():
    separator(13, "Determinant (Area Scaling Factor)")
    M_scale = np.array([[2.0, 0.0],
                        [0.0, 1.5]])
    M_collapse = np.array([[1.0, 1.0],
                           [1.0, 1.0]])

    det_scale = np.linalg.det(M_scale)
    det_collapse = np.linalg.det(M_collapse)
    print(f"det(M_scale) = {det_scale:.2f} (Area scales by {det_scale:.2f}x)")
    print(f"det(M_collapse) = {det_collapse:.2f} (Space collapses into 1D line)")
    print("Intuition: Determinant measures the factor by which area/volume changes.")


def phase_14_inverse():
    separator(14, "Matrix Inverse (Undoing Space)")
    M = np.array([[1.5, 0.5],
                  [0.0, 1.2]])
    M_inv = np.linalg.inv(M)
    v = np.array([2.0, 1.0])
    v_trans = M @ v
    v_restored = M_inv @ v_trans
    print(f"Matrix M:\n{M}\n")
    print(f"Inverse M^(-1):\n{M_inv}\n")
    print(f"Original v: {v}")
    print(f"Transformed M @ v: {v_trans}")
    print(f"Restored M^(-1) @ (M @ v): {v_restored}")
    print("Intuition: The inverse matrix reverses the transformation back to the origin.")


def phase_15_many_vectors():
    separator(15, "Transforming Many Vectors Simultaneously")
    np.random.seed(42)
    vectors = np.random.randn(100, 2)
    M = np.array([[0.0, -1.0],
                  [1.0,  0.0]])  # 90 deg rotation
    transformed = vectors @ M.T
    print(f"Input shape: {vectors.shape} (100 vectors)")
    print(f"Transformed shape: {transformed.shape} (100 transformed vectors)")
    print("Intuition: We apply the same matrix transformation to an entire batch of data.")


def phase_16_vectorization():
    separator(16, "What Vectorization Actually Means")
    np.random.seed(42)
    N = 200000
    vectors = np.random.randn(N, 2)
    M = np.array([[1.5, 0.5],
                  [0.2, 1.2]])

    # Approach A: Python loop
    t0 = time.perf_counter()
    res_loop = np.array([M @ v for v in vectors[:50000]])  # Subsample for speed
    t_loop = (time.perf_counter() - t0) * (N / 50000)

    # Approach B: Vectorized array multiplication
    t0 = time.perf_counter()
    res_vec = vectors @ M.T
    t_vec = time.perf_counter() - t0

    print(f"Benchmark on {N:,} vectors:")
    print(f"  * Python loop estimated time:  {t_loop*1000:.2f} ms")
    print(f"  * Vectorized NumPy (@) time:   {t_vec*1000:.2f} ms")
    print(f"  * Speedup factor:              {t_loop / t_vec:.1f}x faster!")
    print("Intuition: Vectorization bypasses interpreter loops and uses native SIMD BLAS code.")


def phase_17_simd():
    separator(17, "SIMD CPU Hardware Concept")
    data = np.array([1.0, 2.0, 3.0, 4.0], dtype=np.float32)
    scalar = 2.0
    result = data * scalar
    print(f"128-bit Vector Register Input: {data}")
    print(f"Single Instruction Applied:    MULPS by {scalar}")
    print(f"Output in 1 CPU Cycle:         {result}")
    print("Intuition: Single Instruction, Multiple Data executes parallel lanes in hardware.")


def main():
    print("=" * 60)
    print("  INTERACTIVE LINEAR ALGEBRA LABORATORY - NUMPY RUNNER")
    print("=" * 60)
    phase_1_vector()
    phase_2_vector_length()
    phase_3_addition()
    phase_4_subtraction()
    phase_5_scalar_multiplication()
    phase_6_dot_product()
    phase_7_cross_product()
    phase_8_basis_vectors()
    phase_9_matrices_as_machines()
    phase_10_transform_entire_grid()
    phase_11_matrix_vector_arithmetic()
    phase_12_matrix_multiplication_order()
    phase_13_determinant()
    phase_14_inverse()
    phase_15_many_vectors()
    phase_16_vectorization()
    phase_17_simd()
    print("\n" + "=" * 60)
    print("  ALL 17 PHASES DEMONSTRATED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()
